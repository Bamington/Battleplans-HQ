# HANDOFF — Mini Myths archive import

**STATUS: imported.** 89 packs are live in production (95 total with the 6 that
were already there). Verified by replaying all 23 schedules back out of
production against the parsed source: 0 mismatches in time, label and kind.

Two corrective scripts, in `tools/minimyths-ingest/transform/`:

- **`fix_host_club.sql` — REQUIRED.** Without it all 89 packs are invisible to
  the club's own organisers. See "The host club" below.
- `fix_sections.sql` — 5 Prizes rows, cosmetic. See "Section extraction
  defects".

---

# Original handoff — applying the Mini Myths archive import

Everything is built, tested and committed. **Only the apply is left**, and it was
blocked purely on credentials, not on anything unresolved about the data.

Branch: `claude/brave-galileo-cz7mt8` (at `75bf7b9` when this was written).

## What is left to do, in order

1. ~~Apply `20261116120000_minimyths_archive_venues.sql`~~ — **DONE**, all 5
   locations confirmed present in production.
2. Run `tools/minimyths-ingest/transform/import.sql`.
3. Run the verification queries commented at the bottom of that file.

Expected after the import: **89 packs, 92 segments, 133 schedule items, 133
category rows**, and zero packs with a null `starts_on`.

```
supabase link --project-ref dezjjuumsrpfioyfhyzg
supabase migration list --linked     # CLAUDE.md requires this before db push
supabase db push
psql "<connection string>" -f tools/minimyths-ingest/transform/import.sql
```

`import.sql` is one transaction and is idempotent (ids are uuid5-derived from
the Notion page id, every row is guarded). A failure rolls back whole; a second
apply is a no-op.

## Facts you do not need to re-derive

- Production project ref: **`dezjjuumsrpfioyfhyzg`**. The repo also contains
  `dthxptbozocrbvmhwvao` in one old migration and in
  `.claude/settings.local.json` — that is **not** production. Confirmed by the
  user.
- `owner_id` used throughout: **`c0fab326-f180-4fe6-bf1b-87c069be3794`**.
- All 89 packs are `status = 'published'`. The user explicitly declined draft
  staging.

## Pre-flight: already run, all clean

Run read-only against production through the anon key. No need to repeat.

| check | result |
|---|---|
| slug collisions between the 89 and production | **0** |
| slugs production already holds | 5 (`burrow-40k-rtt`, `top-table-strikes-back`, `test-quarmaggedon-3`, `zz-e2e-do-not-use`, `zz-trigger-probe`) |
| the 5 archive venue ids present already | no — migration genuinely pending |
| the 16 game ids referenced | 16 of 16 exist |
| the 8 location ids referenced | 3 of 8 exist (the other 5 are what the migration creates) |

Zero slug collisions is the important line: `battlepack_slugs` never releases a
slug, so a collision would make the pack insert raise rather than skip.

## Why it was not applied

The session had no write credentials: the Supabase CLI was not linked, there was
no access token, and the only database access was a proxy-injected **anon** key
(read-only here).

A Supabase personal access token was requested for `api.supabase.com` so the
import could run through the Management API query endpoint, but every call
returned `401 JWT could not be decoded` — including a call sent with no
`Authorization` header at all, which proves the proxy *was* injecting a value
that Supabase could not decode. Proxy injection itself works (requests to
`dezjjuumsrpfioyfhyzg.supabase.co` with the anon key return live data), so the
saved token value is wrong for that host.

The Management API needs an account-level personal access token (`sbp_…`, from
supabase.com/dashboard/account/tokens). A project `anon`/`service_role` key, or
one of the newer `sb_secret_…` keys, will not work there.

A `service_role` key is **not** a substitute: PostgREST cannot run DDL or a
transactional multi-statement file, so using it would mean reimplementing the
import's guards as separate HTTP calls with no transaction — turning a tested
atomic file into something that can half-apply.

## Already hit and fixed: location_id NOT NULL

The first production attempt failed with `23502 null value in column
"location_id"`. The transaction rolled back whole — nothing was imported — and
the venues migration had already applied cleanly.

Cause: `20260728000000` sets `battlepacks.location_id NOT NULL` (RLS derives
edit access entirely from the venue). That migration cannot fully apply to a
stub harness, so the constraint was missing locally and the import passed there.
Exactly one event, the at-home Clash of Rhyfles painting competition, has no
Notion Location; it now takes Guf Werribee — the club's home venue, where every
other Quarmaggedon event ran, and named in its own body. Change it in
`build.py` if you disagree, then regenerate.

Re-verified against a harness with that constraint forced on: 89 / 89 / 92 /
133 / 133, zero null `starts_on`, zero null `location_id`, idempotent over two
passes.

## Two schema traps — do not "simplify" the import past these

Both were found by applying the real migrations to a throwaway Postgres 16 and
running the import against it. **Neither raises an error in production**; the
first fails silently and the second stores the wrong thing. `README.md` has the
full reasoning.

1. **Items store `duration_minutes`, not clock times.** Migration
   `20260728010000` dropped `starts_at`/`ends_at` from
   `battlepack_schedule_items`. Clock times are derived from the segment anchor
   plus preceding durations. The import emits a contiguous duration chain; all
   23 chains were replayed against the parsed source with 0 mismatches. The 6
   gaps the sources state are their own `break` items, because folding a
   50-minute packup into Round 3 would render it as 150 minutes.

2. **Segment 1 already exists by the time you could insert it.**
   `battlepacks_create_first_segment` is an AFTER INSERT trigger that creates
   ordinal 1 from the pack's date columns. Leaving those null — on the correct
   reasoning that `20260821050000` made segments authoritative — yields a null
   segment, a guarded insert that silently skips, and 89 dateless packs with no
   schedule. The import writes the pack dates, lets the trigger fire, then
   UPDATEs segment 1.

No notification email is sent: `notify_battlepack_segment_change()` returns
early unless the pack has a row in `battlepack_calendar_adds`, and a new pack
has none. Verified.

## Verified before handoff

Applied twice to a throwaway cluster running the actual battlepack migrations.
Counts came out 89 / 92 / 133 / 133 with 0 null `starts_on` and 0 orphaned
`segment_id`, and **the second pass changed nothing** — idempotency tested, not
asserted.

## Judgement calls already made with the user

- Cancelled events (Battle for the Amethyst City, Arcpoint 2025) are imported
  **as published**; their bodies explain the cancellation.
- Slugs are `slugify(name)`, except the 4 live mini-myths.com URLs that differ
  (including `mayhem-of-mustafar`, a typo that is nonetheless the live public
  URL), and the one genuine collision — two "Shatterpoint Learn to Play" events
  (2023, 2024) — resolved by year-suffixing the later.
- Prizes / What to Bring / Resources / FAQ are extracted from event bodies.
  Tickets and Registration come from Notion properties and are exact.
- No Notion ids are written to the database.

## Known imperfections, deliberately left as-is

- **13 packs** have a final schedule item with no end time in the source, so its
  duration defaults to the schema's 60 minutes. Every *start* time is exact;
  only the last item's length is a guess.
- **Battle for the Amethyst City** Round 3 reads 15:30–19:00 (a 3.5h round) with
  presentation at 19:00. Almost certainly a source typo for 17:30, but unlike
  the `12:15 AM` bug there is no unambiguous correction, so it is faithful.
- Two source typos *were* auto-repaired and logged: Jump To Jakku and Defense of
  Mandalore both carry `12:15 AM - Round 1 complete` from the same template.
- `Operation Frostbite` has a resource whose title is a full sentence, and
  `Purple Palette: Fantasy` has a "prize" that is really a qualifying rule.

## The host club — why the imported packs were invisible

`battlepacks` carries two location columns and they mean different things:

- `location_id` — **where it happened**. NOT NULL.
- `host_location_id` — **the club running it**. NULL means the venue runs it
  itself.

The read policy (`20260818020000`) grants access through *either*, via
`administers_location` / `is_location_organiser`. The import set only
`location_id`, mostly Guf Werribee — a store the Mini Myths organisers do not
administer — and left the host club null. Result: `listPacks()` applies no
filter of its own, RLS returned nothing, and My BattlePacks showed none of the
89 under the Mini Myths context.

Every event in this archive is a Mini Myths event; that is the filter the
source snapshot was taken under. So `host_location_id` is
`53809c67-b6a5-4ebc-8941-9c14da626d5a` for all 89. `stage2.py` and `gen_sql.py`
now set it on insert, and `fix_host_club.sql` backfills the rows already in
production (scoped to the 89 ids explicitly, so no pre-existing pack is
touched).

The lesson for anything similar: a NOT NULL column being satisfied does not
mean the right column was filled. `location_id` was required and correct, and
the import still produced 89 rows nobody could see.

## Section extraction defects found after import

Reading the imported rows back out of production (not the local plan) surfaced
four defects in the Prizes extraction. All are fixed in `sections.py`, and
`fix_sections.sql` carries the corrections for the 5 affected rows.

1. A Prizes block naming each prize as a `#` sub-heading collapsed into one
   item titled "Prize pool" — Quarmaggedon's three awards became one blob.
2. Markdown markers (`###`, `**`, `>`) leaked into jsonb section values.
3. The same prize was collected twice where an outer section and its own
   sub-heading both matched the Prizes anchor (Duel of the Fates 2025 listed
   five sponsors twice).
4. A heading with no prose of its own ("Rewards, Prizes, and Giveaways") became
   an empty-bodied prize rather than a container for the headings below it.

A bold-only LINE is deliberately **not** treated as a sub-heading: it finds a
section fine (Quarmaggedon II titles its schedule `**Structure of the event**`)
but authors also bold whole sentences, and promoting "Performance does not
affect your chances!" to a prize title is worse than leaving the block as prose.

Regenerate the script after any further change with:

    python3 gen_fix.py <live-categories.json>

where the argument is a dump of `battlepack_categories` (pack_id,
category_key, content) from production.

## Still open, unrelated to the import

- The Mini Myths club location row has `is_test = true` — one checkbox in
  Manage Locations. `battlepack_by_slug` does not filter on `is_test`, so
  rendering is unaffected.
- Production holds `zz-e2e-do-not-use`, `zz-trigger-probe` and
  `test-quarmaggedon-3`. The slugs are burned permanently (harmless), but if the
  packs behind them are live test data, consider unpublishing them before 89
  real archive packs land alongside.
- `owner_id` appears in committed files (`gen_sql.py` line 11 and throughout
  `import.sql`). It is a UUID, not a credential. Can be parameterised if wanted.

## If the data must be regenerated

Run order, from `tools/minimyths-ingest/transform/`:

```
python3 build.py      # raw + maps -> staging.json
python3 stage2.py     # -> plan.json (packs, segments, duration chain, sections)
python3 sections.py   # bodies -> sections.json
python3 merge.py      # folds sections into plan.json
python3 gen_sql.py    # -> import.sql
```

`raw/` is a frozen snapshot and should not be casually refetched — the import is
reconciled against it. The 89 events were already filtered to Mini Myths only.
