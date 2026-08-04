# Notion battle photos

Chris logged his tabletop games in Notion for years before BattlePlan existed.
The rows were backfilled into `battles` (ids 73–349, stamped `2026-07-13
03:01:26`), but the photos on those pages never came across. These scripts move
them.

Run in order. Steps 1 and 2 need a Notion token; 3 and 4 don't.

## 0. Token

Create an internal integration at <https://www.notion.so/my-integrations>, then
add it to the **⚔️ Tabletop Games** database (••• → Connections). Integrations
see nothing until they're explicitly shared.

```powershell
$env:NOTION_TOKEN = "ntn_..."
```

## 1. Inventory — which pages have photos

```powershell
node tools/notion-photos/inventory.mjs
```

Walks all 304 rows, recursing into page bodies (images hide inside columns and
toggles). Writes `inventory.json`. Last run: 275 pages carry 285 photos, none
externally linked.

## 2. Download — the bytes, plus what's needed to place them

```powershell
node tools/notion-photos/download.mjs
```

Notion signs its file URLs and they expire in ~5 minutes, so this fetches a
page's blocks and pulls its images immediately, page by page. Also resolves each
page's game, players and winners. Writes `metadata.json`; photos go to
`%LOCALAPPDATA%\notion-battle-photos` (override with `PHOTO_DIR`) — deliberately
outside the repo, which is a synced OneDrive folder.

Resume-safe: re-run after a failure and anything already on disk is skipped.

## 3. Match — which page belongs to which battle

First refresh the app side (needs the linked project, so run from the main
working tree, not a worktree):

```powershell
npx supabase db query --linked "select b.id, b.user_id::text as user_id, b.date_played::text as date, coalesce(g.name,'?') as game, coalesce(b.opp_name,'') as opp, coalesce(b.result,'') as result, (select count(*) from public.battle_images i where i.battle_id=b.id) as photos from public.battles b left join public.games g on g.id=b.game_id where b.user_id='<uuid>' order by b.date_played, b.id"
```

Strip the wrapper and keep `.rows` as `battles.json`. Then:

```powershell
node tools/notion-photos/match.mjs
```

The backfill kept no reference to the page each row came from, so there's no key
to join on. Date is the only guarantee, and it isn't enough on tournament days.
Two more signals narrow it: the **game** (disqualifying — a Blood Bowl photo must
never land on a Shatterpoint battle) and the **opponent**, derived by dropping
Chris from Notion's Players list. Different rounds have different opponents,
which separates games that date and game cannot.

Output is graded `confident` / `likely` / `positional`, plus a `review` list
where the counts disagree. Only pairings, no side effects.

## 4. Upload — stage the files, emit the migration

```powershell
$env:MIGRATION_STAMP = "20260805000000"   # check `supabase migration list --linked` first
node tools/notion-photos/upload.mjs
```

Stages the files under their final bucket paths and writes the `battle_images`
migration. Then, from the main working tree:

```powershell
npx supabase storage cp -r "$env:LOCALAPPDATA\notion-battle-staging\<uuid>" ss:///battle-images/<uuid>/ --linked --experimental -j 8
npx supabase db push --linked
```

Filenames embed the Notion page id, `image_path` is unique and the insert is
`on conflict do nothing`, so the whole pipeline is safe to re-run.

## Known limits

- Photos on dates where the counts disagree, and the 3 undated pages, are left
  out — there's no agreed battle to attach them to.
- A photo can land on the wrong round of a same-day event when the opponent
  doesn't separate them. Chris accepted this: it's obvious in-app and easy to
  fix by hand.
- `battles.json` reflects the moment it was exported. Re-export before matching
  if battles have changed.
