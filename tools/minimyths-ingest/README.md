# Mini Myths event archive → BattlePack ingestion

Tooling and frozen source snapshot for importing the Mini Myths event archive
out of the Notion "Events Database" and into BattlePack.

Notion is upstream; www.mini-myths.com is only a rendering of it, so everything
here is derived from Notion directly. The website's one unique contribution is
the handful of live public slugs, which are preserved explicitly (see below).

## Layout

    raw/         frozen snapshots — do not regenerate casually, the import is
                 reconciled against these
      events.json          89 Mini Myths events with their Notion properties
      notion_games.tsv     28 Notion game pages (id -> name)
      notion_locations.json 27 Notion location pages
      bp_games_live.json   116 live BattlePlans games
      bp_locations_live.json 14 live BattlePlans locations

    bodies/      39 event page bodies, captured verbatim, named <notion_id>.md

    maps/
      classification.tsv   all 89 events: body richness + schedule format
      games.map.tsv        Notion game -> BattlePlans game_id (all LIVE-verified)
      locations.map.tsv    Notion location -> locations.id

    transform/
      schedule.py   free-text schedule -> typed rows (the hard part)
      build.py      snapshot + maps -> staging.json
      sections.py   bodies -> Prizes / What to Bring / Resources / FAQ
      stage2.py     staging.json -> plan.json (packs, segments, items, sections)
      merge.py      folds sections.json into plan.json, reports review items

      gen_sql.py    plan.json -> import.sql
      import.sql    the generated import (89 packs). Idempotent; apply as a
                    role that bypasses RLS (service_role / postgres).

Run order: `build.py` → `stage2.py` → `sections.py` → `merge.py` → `gen_sql.py`.

## Two schema facts that invalidate the obvious approach

Both were found by applying the real migrations to a throwaway Postgres and
running the import against it. Neither would have raised an error in
production — the first fails silently, the second stores the wrong thing.

### Schedule items store DURATION, not clock times

Migration `20260728010000` dropped `starts_at`/`ends_at` from
`battlepack_schedule_items` and replaced them with `duration_minutes`. A round
is "two hours"; where it lands is derived from the segment's `starts_at` plus
every duration before it. Writing clock times would be a second source of truth
that goes stale on the first reorder.

So the import emits a contiguous duration chain, with each duration taken from
the gap to the next item's start. That makes every derived start time match the
source exactly — verified by replaying all 23 chains against the parsed source,
0 mismatches.

The 6 gaps the sources genuinely state (10-minute changeovers, a 50-minute
pre-awards packup) are emitted as their own `break` items. Absorbing a gap into
the preceding round instead would render "Round 3: 150 minutes" when the source
says 100 — actively misleading rather than merely lossy.

### Segment 1 already exists by the time you can insert it

`battlepacks_create_first_segment` is an AFTER INSERT trigger on `battlepacks`
that unconditionally creates segment ordinal 1, copying the pack's `starts_on`,
`ends_on` and `starts_at`.

The intuitive import — leave the pack's date columns null because
`20260821050000` made segments authoritative — therefore produces a segment
full of nulls, a guarded insert for ordinal 1 that silently skips, and 89 packs
with no dates and no schedule. No error is raised.

The import instead writes the pack's date columns, lets the trigger create
segment 1, and then UPDATEs it: to add `ends_at` and a label, and to clear
`ends_on` on a two-day pack whose segment 1 is one day only. The envelope sync
then recomputes the pack's `ends_on` from the segments.

Items deliberately omit `segment_id`; `battlepack_item_default_segment` fills it
with the pack's lowest-ordinal segment, which avoids depending on an id the
trigger generated.

## Verified against a real Postgres

Applied twice to a throwaway cluster running the actual battlepack migrations:

| | expected | got |
|---|---|---|
| packs | 89 | 89 |
| slugs reserved | 89 | 89 |
| segments | 92 | 92 |
| schedule items | 133 | 133 |
| category rows | 133 | 133 |
| packs with null `starts_on` | 0 | 0 |
| items with null `segment_id` | 0 | 0 |

The second pass changed nothing, which is the idempotency claim tested rather
than asserted.

## Why the schedule parser is a normaliser, not a format matcher

The 23 events with a text schedule use **17 distinct formats** — bullet lists,
markdown tables, dot-separated prose, escaped colons (`10\:00am\:`), bare 24h
(`0930`), and ranges written five different ways. Everything therefore funnels
through one time scanner and one label cleaner rather than a per-format branch.

Two traps worth knowing about, both of which produced wrong output before being
fixed:

- **Years parse as times.** "May 2nd, 2026" yields `20:26` under a naive 4-digit
  rule. The 4-digit branch is constrained to `[01]\d[0-5]\d` so a 20xx year can
  never match.
- **Afternoon rollover must never touch an explicit time.** Bare times roll
  forward past midday, but applying that to an `8:30 AM` turned a correct table
  into nonsense. Rollover is gated on the absence of am/pm.

## Known source-data defects

| Event | Defect | Handling |
|---|---|---|
| Jump To Jakku, Defense of Mandalore | both say `12:15 AM - Round 1 complete` (same template bug) | auto-repaired to 12:15, logged as TIME-REPAIRED |
| Jump To Jakku | End property (2025-06-26) precedes start (2025-07-26) | End property dropped |
| Battle for the Amethyst City | Round 3 reads 15:30–19:00, a 3.5h round | imported faithfully; no unambiguous correction |
| Quarmaggedon II | body text date contradicts the start date | start date wins |
| Flashpoint: Winter Warfare | 30-minute hole between R2 end and R3 start | imported faithfully |
| Fumble Rumble I | "Six-Game League" but 12 games described | imported faithfully |
| Battle for the Amethyst City, Arcpoint 2025 | cancelled; body says so | imported as published |

## Date rule (this was backwards in the original plan)

`ends_on` comes from the **Start range's end**, not the "End Date & Time"
property. The End property is a stale leftover on most rows: 15 rows have a
Start range, 52 carry the End property, 2 disagree, and 4 have End *before*
Start. Confirmed against the Quarmaggedon II and Purple Palette 6 bodies.
One-day events keep a NULL `ends_on`, which the envelope-flip migration
requires.

## Slugs are permanent — the one irreversible choice

`battlepack_reserve_slug` is an AFTER INSERT trigger that raises on conflict, so
a re-run cannot duplicate a slugged pack. That gives the import free
idempotency, and it means slugs must be right first time.

Policy: `slugify(name)`, except —

- four live mini-myths.com URLs that differ from it are preserved verbatim,
  including `mayhem-of-mustafar`, which is a typo that is nonetheless the live
  public URL;
- the one genuine collision (two "Shatterpoint Learn to Play" events, 2023 and
  2024) is resolved by year-suffixing the later one.

## No source IDs are retained

Notion IDs are not written to the database — they stop being meaningful once
the import is done. `notion_id` appears in the on-disk plan only, as the join
key for re-running the transform. Idempotency comes from the slug ledger, with
`(name, starts_on)` unique across all rows as a fallback.

## Not yet done

- `owner_id` must be supplied before SQL generation; it is a single constant.
- The venues migration `20261116120000_minimyths_archive_venues.sql` is
  committed but **not applied**.
- The Mini Myths club row still has `is_test = true`.
