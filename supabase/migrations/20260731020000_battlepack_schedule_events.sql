-- 20260731020000_battlepack_schedule_events.sql
--
-- A third kind of schedule item: 'event'.
--
-- Rounds and breaks describe the mechanics of the day — playing, and not
-- playing. Neither fits the things an organiser actually wants to flag on the
-- timetable: prizegiving, a painting competition, a guest demo. Those were
-- being typed in as breaks, which is true in the narrow sense that no game is
-- happening and wrong in every sense that matters — they read as dead time in a
-- row styled to recede.
--
-- Widening the constraint is the whole change. An event carries a duration and
-- a label exactly as the other two do, so nothing else in the table moves.
--
-- Backward-compatible on the shared database: this only ADDS an accepted value.
-- No existing row can violate the new constraint, and nothing writes 'event'
-- until BattlePack deploys.
--
-- Idempotent: safe to re-run.

alter table public.battlepack_schedule_items
  drop constraint if exists battlepack_schedule_items_kind_check;

alter table public.battlepack_schedule_items
  add constraint battlepack_schedule_items_kind_check
  check (kind in ('round', 'break', 'event'));

comment on column public.battlepack_schedule_items.kind is
  'round | break | event. Rounds are play, breaks are the gaps, events are the things worth flagging on the timetable — prizegiving, a demo, a painting competition.';
