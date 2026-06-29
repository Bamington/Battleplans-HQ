-- migration_ryg_prerequisites.sql
--
-- Adds a 'prerequisites' column to addons.
-- Stores an array of prerequisite rules that must ALL be satisfied before
-- this addon can be added to a card.
--
-- Each rule object:
--   { "addonTypeSlug": "talents", "paramKey": "type", "paramValue": "Blood Magic" }
--
-- Meaning: the card must have at least one addon of that type whose
-- card_addons.params contains paramValue at paramKey.

alter table public.addons
  add column if not exists prerequisites jsonb not null
    default '{"requireAll":false,"items":[]}'::jsonb;
