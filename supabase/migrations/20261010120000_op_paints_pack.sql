-- ============================================================
-- OP Paints (Obnoxiously Pigmented Paints) — official paint pack (BattleBench)
--
-- The complete range as sold on oppaints.com: 22 colours. (The site's bundle
-- copy says 23, but its own URL, product photos and shop listing all have 22.)
--
-- Five of these already existed as Chris's private paints (Aged Bone, Lilac,
-- Luna Yellow, Rose, Warp Green), used by his recipes and a model. Rather than
-- duplicate them, they are PROMOTED to official public paints (owner NULL,
-- public) — same ids, so every recipe and model link keeps working. The other
-- 17 are added new.
--
-- Swatches are sampled from OP's own product photos (the lit shoulder of each
-- bottle; Carbon Black from the shadowed base, whose lit side reflects blue).
--
-- Idempotent: every insert checks for an existing row first.
-- ============================================================

WITH op_range (name, swatch, display_order) AS (
    VALUES
        ('Deep Carmine',         '#3f1e27',  0),
        ('Red Oxide',            '#cd5656',  1),
        ('Vermilion',            '#f82d31',  2),
        ('Cherry Red',           '#ec334d',  3),
        ('Rose',                 '#ed6b7e',  4),
        ('Lilac',                '#c1c2f1',  5),
        ('Royal Purple',         '#9251ab',  6),
        ('Prussian Blue',        '#14327e',  7),
        ('Kobold Blue',          '#22b0eb',  8),
        ('Azure Blue',           '#80d5f3',  9),
        ('Peacock Green',        '#3abebb', 10),
        ('Emerald Green',        '#19c095', 11),
        ('Warp Green',           '#4bf28a', 12),
        ('Luna Yellow',          '#f0ee4b', 13),
        ('Helios Yellow',        '#fbc21e', 14),
        ('Yellow Oxide',         '#eec654', 15),
        ('Ignis Orange',         '#fe762a', 16),
        ('Deep Umber',           '#6b4640', 17),
        ('Aged Bone',            '#f3e7df', 18),
        ('Neutral White',        '#f6f6f6', 19),
        ('Feel No Payne''s Grey', '#586272', 20),
        ('Carbon Black',         '#16171b', 21)
),

-- 1. Promote Chris's private copies to official, with the sampled swatch.
promoted AS (
    UPDATE public.hobby_items h
       SET owner = NULL, public = true, swatch = r.swatch
      FROM op_range r
     WHERE h.brand = 'OP Paints'
       AND h.name  = r.name
       AND h.owner = 'c0fab326-f180-4fe6-bf1b-87c069be3794'
    RETURNING h.id
)
SELECT count(*) FROM promoted;

-- 2. Add the rest of the range as official paints (skipping any already official).
INSERT INTO public.hobby_items (type, name, brand, swatch, owner, public)
SELECT 'Paint', r.name, 'OP Paints', r.swatch, NULL, true
FROM (VALUES
        ('Deep Carmine', '#3f1e27'), ('Red Oxide', '#cd5656'), ('Vermilion', '#f82d31'),
        ('Cherry Red', '#ec334d'), ('Rose', '#ed6b7e'), ('Lilac', '#c1c2f1'),
        ('Royal Purple', '#9251ab'), ('Prussian Blue', '#14327e'), ('Kobold Blue', '#22b0eb'),
        ('Azure Blue', '#80d5f3'), ('Peacock Green', '#3abebb'), ('Emerald Green', '#19c095'),
        ('Warp Green', '#4bf28a'), ('Luna Yellow', '#f0ee4b'), ('Helios Yellow', '#fbc21e'),
        ('Yellow Oxide', '#eec654'), ('Ignis Orange', '#fe762a'), ('Deep Umber', '#6b4640'),
        ('Aged Bone', '#f3e7df'), ('Neutral White', '#f6f6f6'), ('Feel No Payne''s Grey', '#586272'),
        ('Carbon Black', '#16171b')
     ) AS r (name, swatch)
WHERE NOT EXISTS (
    SELECT 1 FROM public.hobby_items h
     WHERE h.brand = 'OP Paints' AND h.name = r.name AND h.owner IS NULL AND h.public
);

-- 3. The official pack (one, however often this runs).
INSERT INTO public.paint_packs (name, brand, description, is_public, is_official, owner)
SELECT 'OP Paints Complete Range', 'OP Paints',
       'The full range of Obnoxiously Pigmented Paints — 22 high-pigment acrylics, made in Australia.',
       true, true, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM public.paint_packs WHERE is_official AND brand = 'OP Paints'
);

-- 4. Fill it, in the order the shop lists them.
INSERT INTO public.paint_pack_items (pack_id, hobby_item_id, display_order)
SELECT p.id, h.id, o.display_order
FROM public.paint_packs p
JOIN (VALUES
        ('Deep Carmine', 0), ('Red Oxide', 1), ('Vermilion', 2), ('Cherry Red', 3),
        ('Rose', 4), ('Lilac', 5), ('Royal Purple', 6), ('Prussian Blue', 7),
        ('Kobold Blue', 8), ('Azure Blue', 9), ('Peacock Green', 10), ('Emerald Green', 11),
        ('Warp Green', 12), ('Luna Yellow', 13), ('Helios Yellow', 14), ('Yellow Oxide', 15),
        ('Ignis Orange', 16), ('Deep Umber', 17), ('Aged Bone', 18), ('Neutral White', 19),
        ('Feel No Payne''s Grey', 20), ('Carbon Black', 21)
     ) AS o (name, display_order) ON true
JOIN public.hobby_items h
  ON h.brand = 'OP Paints' AND h.name = o.name AND h.owner IS NULL AND h.public
WHERE p.is_official AND p.brand = 'OP Paints'
ON CONFLICT (pack_id, hobby_item_id) DO NOTHING;
