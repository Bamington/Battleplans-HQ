#!/usr/bin/env python3
"""Copy each archive event's Notion page cover into BattlePack as its banner.

Run this yourself: it needs two credentials this session never had, and it
writes to production.

    pip install pillow requests

    export NOTION_TOKEN=secret_...            # Notion internal integration
    export SUPABASE_URL=https://dezjjuumsrpfioyfhyzg.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service_role, NOT anon

    python3 import_banners.py --dry-run       # look first
    python3 import_banners.py --limit 3       # try three
    python3 import_banners.py                 # the rest

WHAT IT DOES, per pack
  1. GET the Notion page and read its `cover`.
  2. Download the image. A Notion-hosted cover is an S3 URL whose signature
     expires in minutes, which is why the download happens immediately after
     the fetch rather than in a separate pass.
  3. Centre-crop to 3:1 and downscale to 1800x600 JPEG — the same shape the
     in-app cropper produces, and the band the game artwork fallback is drawn
     for (GAME_BANNER_ASPECT = 3 in PackDocument.tsx).
  4. Upload to `pack-banners/{pack_id}/{ts}-{rand}.jpg`, matching
     uploadPackBanner() in apps/battlepack/src/lib/packs.ts. service_role
     bypasses RLS, so nothing here forces that layout — but the bucket policy
     resolves the FIRST PATH SEGMENT through can_edit_battlepack(), so a file
     put anywhere else could never afterwards be replaced or deleted by an
     organiser through the app.
  5. PATCH battlepacks.banner_path / banner_aspect.

SAFETY
  - Skips any pack that already has a banner_path, so it is re-runnable and
    will not overwrite anything you set by hand. --force overrides.
  - Writes banners.log.json as it goes; a re-run skips what already succeeded,
    so an interrupted run resumes rather than restarting.
  - --dry-run does every read and no write.
  - Credentials come from the environment only. Nothing is written to disk but
    the log, which holds no secrets.

NOTE ON THE NOTION TOKEN
  An internal integration token, from notion.so/my-integrations. The
  integration must be shared with the Events Database (open the database →
  ••• → Connections → add it), or every page returns 404.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import random
import sys
import time
import uuid
from pathlib import Path

try:
    import requests
    from PIL import Image
except ImportError:
    sys.exit("missing deps — run:  pip install pillow requests")

HERE = Path(__file__).resolve().parent
PLAN = HERE / "plan.json"
LOG = HERE / "banners.log.json"

# Must match gen_sql.py, or the pack ids will not line up.
NS = uuid.UUID("6f9b1d2c-8a4e-4c3b-9f71-2d5e8a0c4b16")

BUCKET = "pack-banners"
TARGET_W, TARGET_H = 1800, 600
ASPECT = TARGET_W / TARGET_H          # 3.0; battlepacks_banner_aspect_sane wants 1.4..20
JPEG_QUALITY = 82
NOTION_VERSION = "2022-06-28"


def pack_id(notion_id: str) -> str:
    return str(uuid.uuid5(NS, f"pack|{notion_id}"))


def load_log() -> dict:
    if LOG.exists():
        try:
            return json.loads(LOG.read_text())
        except json.JSONDecodeError:
            print("! banners.log.json is unreadable; starting a fresh log")
    return {}


def save_log(log: dict) -> None:
    LOG.write_text(json.dumps(log, indent=1))


def notion_cover(session: requests.Session, token: str, notion_id: str) -> str | None:
    """The page's cover URL, or None. Raises on anything but 200/404."""
    r = session.get(
        f"https://api.notion.com/v1/pages/{notion_id}",
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
        },
        timeout=30,
    )
    if r.status_code == 404:
        return None
    if r.status_code == 429:
        wait = int(r.headers.get("Retry-After", "5"))
        time.sleep(wait)
        return notion_cover(session, token, notion_id)
    r.raise_for_status()
    cover = r.json().get("cover")
    if not cover:
        return None
    # "file" is Notion-hosted and the URL is a short-lived signature;
    # "external" is a plain URL the user pasted in.
    return (cover.get("file") or cover.get("external") or {}).get("url")


def to_banner(raw: bytes) -> bytes:
    """Centre-crop to 3:1 and downscale to 1800x600 JPEG."""
    im = Image.open(io.BytesIO(raw))
    if im.mode in ("RGBA", "LA", "P"):
        # JPEG has no alpha; flatten onto white rather than letting it go black
        im = im.convert("RGBA")
        flat = Image.new("RGB", im.size, (255, 255, 255))
        flat.paste(im, mask=im.split()[-1])
        im = flat
    else:
        im = im.convert("RGB")

    w, h = im.size
    if w / h > ASPECT:                       # too wide: trim the sides
        new_w = int(round(h * ASPECT))
        left = (w - new_w) // 2
        im = im.crop((left, 0, left + new_w, h))
    else:                                    # too tall: trim top and bottom
        new_h = int(round(w / ASPECT))
        top = (h - new_h) // 2
        im = im.crop((0, top, w, top + new_h))

    im = im.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return buf.getvalue()


def upload(session: requests.Session, base: str, key: str, path: str, blob: bytes) -> None:
    r = session.post(
        f"{base}/storage/v1/object/{BUCKET}/{path}",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "image/jpeg",
            "x-upsert": "false",
        },
        data=blob,
        timeout=120,
    )
    if not r.ok:
        raise RuntimeError(f"upload failed {r.status_code}: {r.text[:300]}")


def set_banner(session: requests.Session, base: str, key: str, pid: str, path: str) -> None:
    r = session.patch(
        f"{base}/rest/v1/battlepacks",
        params={"id": f"eq.{pid}"},
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json={"banner_path": path, "banner_aspect": ASPECT},
        timeout=60,
    )
    if not r.ok:
        raise RuntimeError(f"patch failed {r.status_code}: {r.text[:300]}")


def current_banners(session: requests.Session, base: str, key: str) -> dict[str, str | None]:
    r = session.get(
        f"{base}/rest/v1/battlepacks",
        params={"select": "id,banner_path"},
        headers={"Authorization": f"Bearer {key}", "apikey": key},
        timeout=60,
    )
    r.raise_for_status()
    return {row["id"]: row["banner_path"] for row in r.json()}


def main() -> int:
    ap = argparse.ArgumentParser(description="Copy Notion page covers into BattlePack banners.")
    ap.add_argument("--dry-run", action="store_true", help="read everything, write nothing")
    ap.add_argument("--limit", type=int, default=0, help="only process the first N")
    ap.add_argument("--force", action="store_true", help="replace an existing banner too")
    ap.add_argument("--only", metavar="TEXT", help="only packs whose name contains TEXT")
    args = ap.parse_args()

    token = os.environ.get("NOTION_TOKEN")
    base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    missing = [n for n, v in
               (("NOTION_TOKEN", token), ("SUPABASE_URL", base),
                ("SUPABASE_SERVICE_ROLE_KEY", key)) if not v]
    if missing and not args.dry_run:
        sys.exit("missing environment variables: " + ", ".join(missing))
    if not token:
        sys.exit("NOTION_TOKEN is required even for --dry-run (it reads the covers)")

    plan = json.loads(PLAN.read_text())
    log = load_log()
    session = requests.Session()

    existing: dict[str, str | None] = {}
    if base and key:
        try:
            existing = current_banners(session, base, key)
        except Exception as e:                      # noqa: BLE001
            print(f"! could not read current banners ({e}); relying on the log only")

    todo = []
    for p in plan:
        name = p["pack"]["name"]
        if args.only and args.only.lower() not in name.lower():
            continue
        pid = pack_id(p["notion_id"])
        if not args.force:
            if log.get(pid, {}).get("ok"):
                continue
            if existing.get(pid):
                continue
        todo.append((p["notion_id"], pid, name))
    if args.limit:
        todo = todo[: args.limit]

    print(f"{len(todo)} pack(s) to do"
          f"{' — DRY RUN, nothing will be written' if args.dry_run else ''}\n")

    done = skipped = failed = 0
    for i, (nid, pid, name) in enumerate(todo, 1):
        prefix = f"[{i}/{len(todo)}] {name[:46]:<46}"
        try:
            url = notion_cover(session, token, nid)
            if not url:
                print(f"{prefix} no cover on the Notion page — skipped")
                log[pid] = {"ok": False, "reason": "no cover", "name": name}
                skipped += 1
                continue

            raw = session.get(url, timeout=120)
            raw.raise_for_status()
            blob = to_banner(raw.content)

            path = f"{pid}/{int(time.time() * 1000)}-{random.randbytes(3).hex()}.jpg"
            if args.dry_run:
                print(f"{prefix} would upload {len(blob) // 1024:>4} KB -> {path}")
                done += 1
                continue

            upload(session, base, key, path, blob)
            set_banner(session, base, key, pid, path)
            log[pid] = {"ok": True, "path": path, "name": name}
            save_log(log)
            print(f"{prefix} {len(blob) // 1024:>4} KB -> {path}")
            done += 1
        except Exception as e:                      # noqa: BLE001
            print(f"{prefix} FAILED: {e}")
            log[pid] = {"ok": False, "reason": str(e)[:200], "name": name}
            if not args.dry_run:
                save_log(log)
            failed += 1
        time.sleep(0.35)                            # be polite to the Notion API

    if not args.dry_run:
        save_log(log)
    print(f"\ndone: {done}   skipped (no cover): {skipped}   failed: {failed}")
    if failed:
        print("re-run to retry only the failures; successes are skipped via banners.log.json")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
