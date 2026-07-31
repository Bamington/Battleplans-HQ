-- 20260731030000_link_previews.sql
--
-- Cache for the Open Graph tags behind a link.
--
-- A pack's Tickets and Registration sections carry a URL, and the document
-- wants to show what is on the other end. A browser cannot read those tags —
-- CORS stops it fetching another origin's HTML — so an Edge Function does it
-- server-side. This is where the answer is kept.
--
-- WITHOUT THIS TABLE the function refetches on every render, which means every
-- visitor to a published pack sends a request to the ticketing site. A popular
-- event would be pointing a crowd at somebody else's server for nothing. Once
-- fetched, everyone after gets the row.
--
-- FAILURES ARE CACHED TOO, which is the point of `ok`. A dead link, a site that
-- blocks bots, a 404 — all of them cost a request and a timeout to discover,
-- and rediscovering that on every page view is worse than the successful case.
-- `ok = false` with a short refresh window means a link that comes back to life
-- is picked up without hammering one that never will.
--
-- The URL is the primary key, so two packs linking the same ticket page share
-- one row and one fetch.
--
-- Nothing in this table is private: it is a summary of a public web page,
-- fetched because a public pack links to it. Anyone may read it. Only the
-- function writes, using the service role — a client that could write here
-- could put arbitrary text and images under a link the organiser chose.
--
-- Idempotent: safe to re-run.

create table if not exists public.link_previews (
  -- Normalised by the function before lookup, so trailing slashes and the like
  -- do not split one page across several rows.
  url          text primary key,
  title        text,
  description  text,
  image_url    text,
  site_name    text,
  /** False when the fetch failed or the page had nothing worth showing. */
  ok           boolean     not null default true,
  fetched_at   timestamptz not null default now()
);

comment on table public.link_previews is
  'Cached Open Graph summaries of pages linked from packs. Written only by the link-preview Edge Function (service role); world-readable because it summarises public pages linked from public packs.';

alter table public.link_previews enable row level security;

-- Read is open, including to anon: a published pack is world-readable and its
-- link previews have to be too, before there is any session.
drop policy if exists "Anyone can read link previews" on public.link_previews;
create policy "Anyone can read link previews"
  on public.link_previews for select
  to authenticated, anon
  using (true);

-- No insert/update/delete policy at all, so the anon and authenticated roles
-- cannot write. The service role bypasses RLS, which is how the function does.

-- Stale rows are found by age, and the sweep is "everything older than X"
-- rather than per-URL, so the index is on the timestamp.
create index if not exists link_previews_fetched_at_idx
  on public.link_previews (fetched_at);
