-- ============================================================
-- BattleCards — token_definitions: refresh_on_turn + is_activation_token
-- Adds turn-based token refresh support and an activation-token flag.
-- ============================================================

-- ── Columns ──────────────────────────────────────────────────────────────────

alter table public.token_definitions
  add column if not exists refresh_on_turn     integer  not null default 0,
  add column if not exists is_activation_token boolean  not null default false;

comment on column public.token_definitions.refresh_on_turn is
  'Net change applied to this token on each new turn. Positive values add that many tokens '
  '(capped at effective max). Negative values remove that many tokens (capped at 0 / min). '
  '0 disables turn-based refresh.';

comment on column public.token_definitions.is_activation_token is
  'True if this token represents unit activation. The "New Turn" button in Play mode becomes '
  'primary-styled when every card has all its activation tokens fully on.';

-- ── Seed updates ─────────────────────────────────────────────────────────────
-- Halo Flashpoint: wire up the two tokens that change on new turn.

update public.token_definitions td
set refresh_on_turn     = -1,
    is_activation_token = true
from public.games g
where td.game_id = g.id
  and g.slug = 'halo-flashpoint'
  and td.name = 'Activated';

update public.token_definitions td
set refresh_on_turn = 1
from public.games g
where td.game_id = g.id
  and g.slug = 'halo-flashpoint'
  and td.name = 'Shield';
