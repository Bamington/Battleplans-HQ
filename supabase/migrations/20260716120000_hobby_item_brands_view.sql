-- ============================================================
-- Distinct paint brands — for the "Add Paint" brand filter.
--
-- A plain `select('brand')` from the client hits PostgREST's row cap and would
-- miss brands beyond the first page, so expose the distinct set as a view.
-- security_invoker = true so it honours the hobby_items RLS ("Anyone can read
-- the public paint library"): a user sees brands from public paints + their own.
-- ============================================================

CREATE OR REPLACE VIEW public.hobby_item_brands
  WITH (security_invoker = true) AS
SELECT DISTINCT brand
FROM public.hobby_items
WHERE brand IS NOT NULL AND brand <> ''
ORDER BY brand;

GRANT SELECT ON public.hobby_item_brands TO anon, authenticated;
