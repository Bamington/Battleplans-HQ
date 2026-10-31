-- ============================================================
-- Vallejo True Metallic Metal — official paints + two paint packs (BattleBench)
--
-- From Vallejo's CC339 chart: 20 colours, each made in four versions — Light
-- (77.101–120), Base (77.121–140), Shade (77.141–160) and Airbrush
-- (77.161–180). 80 paints.
--
-- The versions share a name, and the paint picker shows only name + brand, so
-- the version goes in the name: "Sterling Silver (Light)". The Vallejo code
-- goes in `code`, as for the other Vallejo ranges.
--
-- Packs (Chris's call): one for Light, Base and Shade, and a separate one for
-- Airbrush. Official packs are unique per (brand, sub_brand), so the Airbrush
-- paints carry their own sub_brand to match their pack.
--
-- Swatches are the average of the middle of each tile on the chart (the tiles
-- are metallic gradients, so any single pixel is unrepresentative). Vallejo's
-- chart uses the same tiles for Base and Airbrush, hence matching swatches.
--
-- Idempotent: every insert checks for an existing row first.
-- ============================================================

CREATE TEMP TABLE tmm (name text, code text, sub_brand text, swatch text, display_order int);

WITH colours (idx, colour) AS (
    VALUES (0, 'Sterling Silver'), (1, 'Radiant Yellow'), (2, 'Imperial Gold'), (3, 'Ancient Copper'),
           (4, 'Forged Red'), (5, 'Ruby Red'), (6, 'Crimson Magenta'), (7, 'Amethyst Purple'),
           (8, 'Celestial Violet'), (9, 'Ultramarine Blue'), (10, 'Sapphire Blue'), (11, 'Hydra Turquoise'),
           (12, 'Beetle Green'), (13, 'Dusken Green'), (14, 'Amber Green'), (15, 'Greenish Gold'),
           (16, 'Arcane Gold'), (17, 'Rusty Metal'), (18, 'Aged Metal'), (19, 'Obsidian Black')
),
versions (version, first_code, sub_brand, pack_offset) AS (
    VALUES ('Light',    101, 'True Metallic Metal',           0),
           ('Base',     121, 'True Metallic Metal',          20),
           ('Shade',    141, 'True Metallic Metal',          40),
           ('Airbrush', 161, 'True Metallic Metal Airbrush',  0)
),
swatches (code, swatch) AS (
    VALUES
        -- Light
        ('77.101', '#e9e9e8'), ('77.102', '#e8d756'), ('77.103', '#d4ae72'), ('77.104', '#e5a17c'),
        ('77.105', '#ea8642'), ('77.106', '#ee9d8d'), ('77.107', '#e497ba'), ('77.108', '#c199c4'),
        ('77.109', '#b3a5ce'), ('77.110', '#79b0c9'), ('77.111', '#4cb2e2'), ('77.112', '#7bccdc'),
        ('77.113', '#8dccb2'), ('77.114', '#7bb589'), ('77.115', '#a3b276'), ('77.116', '#e8d077'),
        ('77.117', '#dcb775'), ('77.118', '#c39f8e'), ('77.119', '#b5a878'), ('77.120', '#97999b'),
        -- Base
        ('77.121', '#b3c2c5'), ('77.122', '#ebc246'), ('77.123', '#cc925e'), ('77.124', '#d8804c'),
        ('77.125', '#d26b50'), ('77.126', '#c04552'), ('77.127', '#be6093'), ('77.128', '#9a67a8'),
        ('77.129', '#8064a7'), ('77.130', '#3d6185'), ('77.131', '#0e7fa7'), ('77.132', '#0f8da7'),
        ('77.133', '#2e9d85'), ('77.134', '#426e52'), ('77.135', '#60814a'), ('77.136', '#8b834b'),
        ('77.137', '#9e713f'), ('77.138', '#84644f'), ('77.139', '#5c5838'), ('77.140', '#434849'),
        -- Shade
        ('77.141', '#434345'), ('77.142', '#705521'), ('77.143', '#583d1e'), ('77.144', '#873f12'),
        ('77.145', '#7a1016'), ('77.146', '#751d38'), ('77.147', '#850d5d'), ('77.148', '#3d0955'),
        ('77.149', '#2a104c'), ('77.150', '#002c61'), ('77.151', '#013e6e'), ('77.152', '#016278'),
        ('77.153', '#006452'), ('77.154', '#003415'), ('77.155', '#1d472b'), ('77.156', '#253610'),
        ('77.157', '#4b3117'), ('77.158', '#433a36'), ('77.159', '#353406'), ('77.160', '#312f30'),
        -- Airbrush
        ('77.161', '#b3c2c5'), ('77.162', '#ecc346'), ('77.163', '#cc925e'), ('77.164', '#d8814c'),
        ('77.165', '#d26c51'), ('77.166', '#c14652'), ('77.167', '#be6193'), ('77.168', '#9a67a8'),
        ('77.169', '#8065a8'), ('77.170', '#3e6285'), ('77.171', '#0e7fa7'), ('77.172', '#0f8ea7'),
        ('77.173', '#309d86'), ('77.174', '#436f52'), ('77.175', '#60814a'), ('77.176', '#8b834b'),
        ('77.177', '#9f7240'), ('77.178', '#84654f'), ('77.179', '#5c5838'), ('77.180', '#444949')
)
INSERT INTO tmm (name, code, sub_brand, swatch, display_order)
SELECT c.colour || ' (' || v.version || ')',
       '77.' || (v.first_code + c.idx),
       v.sub_brand,
       s.swatch,
       v.pack_offset + c.idx
FROM colours c
CROSS JOIN versions v
JOIN swatches s ON s.code = '77.' || (v.first_code + c.idx);

-- 1. The paints, as official public paints (skipping any already there).
INSERT INTO public.hobby_items (type, type_secondary, name, brand, sub_brand, code, swatch, owner, public)
SELECT 'Paint', 'Metallic', t.name, 'Vallejo', t.sub_brand, t.code, t.swatch, NULL, true
FROM tmm t
WHERE NOT EXISTS (
    SELECT 1 FROM public.hobby_items h
     WHERE h.brand = 'Vallejo' AND h.code = t.code AND h.owner IS NULL
);

-- 2. The two official packs (one each, however often this runs).
INSERT INTO public.paint_packs (name, brand, sub_brand, description, is_public, is_official, owner)
SELECT p.name, 'Vallejo', p.sub_brand, p.description, true, true, NULL
FROM (VALUES
        ('Vallejo True Metallic Metal', 'True Metallic Metal',
         'Vallejo''s True Metallic Metal range — 20 metallic colours, each in Light, Base and Shade.'),
        ('Vallejo True Metallic Metal Airbrush', 'True Metallic Metal Airbrush',
         'The airbrush versions of Vallejo''s True Metallic Metal range — 20 metallic colours.')
     ) AS p (name, sub_brand, description)
WHERE NOT EXISTS (
    SELECT 1 FROM public.paint_packs pp
     WHERE pp.is_official AND pp.brand = 'Vallejo' AND pp.sub_brand = p.sub_brand
);

-- 3. Fill them: Light, then Base, then Shade; Airbrush in chart order.
INSERT INTO public.paint_pack_items (pack_id, hobby_item_id, display_order)
SELECT p.id, h.id, t.display_order
FROM tmm t
JOIN public.hobby_items h
  ON h.brand = 'Vallejo' AND h.code = t.code AND h.owner IS NULL
JOIN public.paint_packs p
  ON p.is_official AND p.brand = 'Vallejo' AND p.sub_brand = t.sub_brand
ON CONFLICT (pack_id, hobby_item_id) DO NOTHING;

DROP TABLE tmm;
