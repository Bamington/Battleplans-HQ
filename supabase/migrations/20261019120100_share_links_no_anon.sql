-- share_links holds every share code. RLS already gives anon no rows (it has no
-- anon policy), but the project's default privileges granted anon table
-- access anyway. Belt and braces: anon reaches shared items only through
-- get_shared_item(code), never this table.
REVOKE ALL ON public.share_links FROM anon;
