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

Run order: `build.py` → `stage2.py` → `sections.py` → `merge.py`.

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
