-- ============================================================
-- box_images migration (BattleBox)
--
-- Recovers box/collection cover images from the previous BattlePlan app's
-- box_images table, which was absent from the original CSV export set and so
-- was never migrated. Old primary keys preserved.
--
-- Box images are a mix: 24 are objects in the model-images bucket (already
-- copied to this project) stored as image_path; 12 are external cover-art
-- URLs (eBay, Amazon, warhammer.com, …) stored as image_url. Each row uses
-- exactly one of the two.
--
-- Transaction control is left to the migration runner.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.box_images (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    box_id        uuid NOT NULL REFERENCES public.boxes (id) ON DELETE CASCADE,
    image_path    text,   -- object key in the model-images bucket (uploaded)
    image_url     text,   -- full external URL (linked cover art)
    display_order integer NOT NULL DEFAULT 0,
    is_primary    boolean NOT NULL DEFAULT false,
    user_id       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at    timestamptz DEFAULT now(),
    CONSTRAINT box_images_source_check CHECK (image_path IS NOT NULL OR image_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS box_images_box_id_idx ON public.box_images USING btree (box_id);
-- At most one primary per box (the source data already satisfies this).
CREATE UNIQUE INDEX IF NOT EXISTS box_images_one_primary_idx
    ON public.box_images USING btree (box_id) WHERE is_primary;

ALTER TABLE public.box_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read images for visible boxes"
    ON public.box_images FOR SELECT
    TO authenticated, anon
    USING (EXISTS (
        SELECT 1 FROM public.boxes b
        WHERE b.id = box_images.box_id
          AND (b.public OR b.user_id = auth.uid())
    ));

CREATE POLICY "Owners can manage their box images"
    ON public.box_images
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.boxes b
        WHERE b.id = box_images.box_id AND b.user_id = auth.uid()
    ));

-- ── Data (36 rows) ────────────────────────────────────────────────
INSERT INTO public.box_images
  (id, box_id, image_path, image_url, display_order, is_primary, user_id, created_at)
VALUES
  ('6d3fb2d5-be93-4a80-a11c-be8c54db5996', '0d643f05-aa90-4a69-a1fb-946eab866d58', 'boxes/1758147254406-hvjwrksre5b.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('9305d615-7bb4-411b-b7e8-e7c8285647c4', '273f2f8c-8f1b-463a-a42f-86fe5e7d8e19', 'boxes/1758147151651-ptt0fns3edq.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('6557a9be-99a2-4abe-b6ff-8aab41eb4e2a', '35cc2143-dc71-4006-8e64-b732c4a2c00e', 'ebb2729e-a79b-4183-9463-4125c4d81f56/1757982608262-ttgv8hmbsvr.jpg', NULL, 0, true, 'ebb2729e-a79b-4183-9463-4125c4d81f56', '2025-09-24T08:52:37.479279+00:00'),
  ('77de2b07-e1e8-4e96-a166-8733b3fcbc13', '3679f1e4-2b3d-4f08-a791-99bc4c7b8a79', 'e559b840-bf6c-4a21-a6c4-81d64d1f9910/1760412552938-kjnz7o3w5a.JPEG', NULL, 0, true, 'e559b840-bf6c-4a21-a6c4-81d64d1f9910', '2025-10-14T03:29:17.118154+00:00'),
  ('501f21e6-b9c5-4c00-b47e-3438093fa088', '3679f1e4-2b3d-4f08-a791-99bc4c7b8a79', 'e559b840-bf6c-4a21-a6c4-81d64d1f9910/1760412553765-5q8uey2c2nj.JPEG', NULL, 1, false, 'e559b840-bf6c-4a21-a6c4-81d64d1f9910', '2025-10-14T03:29:17.876166+00:00'),
  ('097b8c62-ecc1-442a-8764-af585be55531', '37368d13-d4ec-498e-ba52-4d294623f20c', NULL, 'https://i.ebayimg.com/images/g/wssAAOSwptRnGUK1/s-l400.png', 0, true, 'e708d0d9-f1d1-48bb-a2f3-c4a8f4de5c66', '2025-09-24T08:52:37.479279+00:00'),
  ('50540d69-980e-4b58-aa7f-0c9658017dd7', '49e9dd4f-e3a5-488c-b766-ba44595229f8', NULL, 'https://icv2.com/images/article_thumbs/650x650_d827c219a703d5de43233103c02ed712db3bc9bacb1130560282756f.jpg', 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('fc26882b-c1f2-45d3-9da5-e80066ee89f8', '4a0ec29a-fcc4-42c2-bff9-742872ca6ef3', 'e559b840-bf6c-4a21-a6c4-81d64d1f9910/1757586172176-m9oxc6hgq.jpeg', NULL, 0, true, 'e559b840-bf6c-4a21-a6c4-81d64d1f9910', '2025-09-24T08:52:37.479279+00:00'),
  ('599cd070-3fbb-42cc-9de1-b740fe3e2a7f', '53626b4f-e577-4ac4-b0b5-2fabbcdbd881', 'boxes/1758061011263-2l014gdfw5f.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('aaf414a2-8d05-4f78-a902-3cea98dfb8ef', '53626b4f-e577-4ac4-b0b5-2fabbcdbd881', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1765330478050-au5v1cz0jtj.JPG', NULL, 1, false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-12-10T01:34:39.687778+00:00'),
  ('26588b81-a245-4433-ab46-08f38ede1d08', '5801a2c2-4d56-4846-b5ee-98c5f188e3c1', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1782979375387-n2ut33u0vdr.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2026-07-02T08:02:56.293406+00:00'),
  ('61095d4a-f171-4f2b-b64d-eed769960ed5', '5eb07e94-65a1-4808-878c-1234a73049e6', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1757850065916-16gpoxyvjtb.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('faf53829-54f6-45a2-a917-718070242c5f', '7286599b-1efe-4ed5-84da-56de6b3260f2', NULL, 'https://cdn11.bigcommerce.com/s-mczajn55d7/images/stencil/500x659/products/12946/49223/451510001_Konflikt47starterset25__24973.1756829935.jpg?c=2', 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-12-10T03:56:14.086743+00:00'),
  ('0ddd4387-2f96-4c79-a330-f5852306980d', '7458b379-45c6-45c1-8d57-eac1c7fc7fc4', NULL, 'https://images.bigbadtoystore.com/images/product/187274/ca6baeb6-d34a-4617-9008-efb98a2243fe/original.jpg', 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2026-05-31T00:03:38.209597+00:00'),
  ('76a7153e-f6c7-4597-8f51-948c5e7b18c7', '76ad2bcf-9be3-43dc-9bb9-70780dcb8aff', 'boxes/1758059605066-b53h3c5l8ud.jpg', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('237292ae-bce8-4a64-937f-be098bdbe9b8', '78585d2f-7093-4c61-a7f0-05a667ff3dcc', 'boxes/1758060988649-t2p5wtmdaa.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('a9d415e5-4e02-4f63-91dd-3b4a8a648feb', '78585d2f-7093-4c61-a7f0-05a667ff3dcc', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1765330494521-csqzp112ko.JPG', NULL, 1, false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-12-10T01:34:55.404624+00:00'),
  ('9ad4a02c-b6a2-486e-9860-17f1850d6894', '7994c58d-ded7-4a39-b4f9-044bed6e277b', 'boxes/1758147824405-rbx5gav2ho.jpg', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('7557a4f2-a735-48a4-ac15-18c8e375ac5c', '7a3efc1c-3537-4210-915b-0de21fa998fc', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1769573940366-6zla1giurev.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2026-01-28T04:19:01.636639+00:00'),
  ('680b996d-3abf-44cd-a25c-c665209a8bda', '7fa4051c-226d-483a-9b32-b55c02a52db3', 'boxes/1758147367594-c9bzledi3el.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('7cec383b-d54b-43c2-b2ae-14d4a455008a', '812503b1-f29c-43b5-a12b-7c32fcd39cd4', NULL, 'https://i.ebayimg.com/images/g/Nm4AAOSwn65muxXv/s-l400.jpg', 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-12-10T03:56:29.516479+00:00'),
  ('f1d4791d-86b3-4448-88aa-ca76a32231e1', '865c182c-d589-49ac-8086-056c992ba8b5', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1782979041700-n2bsfgsko2e.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2026-07-02T07:57:22.412776+00:00'),
  ('e2ba26ad-89ce-49fb-b619-c46bc816975e', '8974b03d-8f99-4d19-a2c5-ff37da5d431b', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1759395898661-quhf4ncq66e.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-10-02T09:04:59.938077+00:00'),
  ('d69e5174-4624-430d-8204-58d405e6b995', '8d3e1629-1e0d-4116-9f34-2c06ce3ab2da', 'boxes/1758147776143-xqhpb2qb0ms.jpg', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('7bfcae7f-0ecb-444d-9c17-be89ed371aa6', '97065ba1-875e-44f4-b823-fd491554f246', NULL, 'https://www.warhammer.com/app/resources/catalog/product/920x950/99120599012_PalaniteSubjucatorPatrol01.jpg?fm=webp&w=670&h=691', 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2026-01-01T23:28:35.580793+00:00'),
  ('e920818c-e363-4d78-baeb-12b6692b2392', 'a3ca2a3e-b5fa-44f6-bd5d-8c651906f4a2', 'boxes/1758148547441-d5jtbxu1si.jpg', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('6a8788b7-72d2-4f04-bbf9-38bf0d76683f', 'a3d157fc-accf-4618-a198-74eba787dcd8', NULL, 'https://i.ebayimg.com/images/g/OLcAAeSwcIBp9LqD/s-l400.jpg', 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2026-05-23T09:52:11.556313+00:00'),
  ('17340d9b-7e04-47e6-a87f-620f09c5d4e4', 'a707bd5b-8595-49da-8bc8-1ec018d5afb8', NULL, 'https://cdn11.bigcommerce.com/s-89ffd/images/stencil/728x728/products/198260/899152/4582769922916_ec4b781d47085f553d81f5723bea30f7__86411.1772096274.jpg?c=2', 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2026-06-27T07:56:35.228453+00:00'),
  ('91e0f4da-c745-4a6e-87ad-7909e208c53a', 'afd95799-806a-47dc-994a-9807fe6aaae2', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1782979016272-eexosdeyea9.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2026-07-02T07:56:57.355723+00:00'),
  ('e950b152-f7df-4d82-9aea-5c9c247d8201', 'b9542d5f-6297-4d50-afc8-72ba223e6018', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1782979828836-p65uky7k7y9.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2026-07-02T08:10:31.2778+00:00'),
  ('0aea40d9-c3b9-4253-9d28-3f037d5d232b', 'bd030d7d-f9a0-447d-bd12-ee5f90fdf818', 'boxes/1758147044761-907jzgqlwf5.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('3b996079-1608-4d8a-a826-24baba86459a', 'cc84f874-8443-431f-b8ac-aa569ed6a1a9', NULL, 'https://i.ebayimg.com/images/g/pWoAAOSwfT5oC8Wk/s-l400.jpg', 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('3f8b4837-c575-45ae-808b-38792c88145a', 'cd209d7d-dba2-475d-a782-ecca850b4604', 'boxes/1756209645452-8zgh0zoxfgl.JPG', NULL, 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00'),
  ('5b12bbc3-8a0e-4c36-85de-5a90a24b08c3', 'cf24b7ef-39f5-4f85-9a36-775b0b30c5d0', NULL, 'https://www.hobbyworkshop.co.uk/media/catalog/product/cache/d451e1cb7d57e9a32f2193ecaa44f472/f/f/ffgswp26_1.jpg', 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2026-01-01T23:29:10.715148+00:00'),
  ('59af8cfc-625a-4358-b545-7726a48d256f', 'e16a8ac3-4e54-41f0-bedd-fe2bfa4f824f', NULL, 'https://www.blitzminis.com/cdn/shop/files/SWP82-image0_2000_1500x_208600a3-7ec4-4717-9d2b-afe7668ea6bb_600x.webp?v=1775546627', 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2026-05-31T23:32:13.478496+00:00'),
  ('18caafe2-c6cf-4a77-abec-325c6059033f', 'f19dc63c-b044-4b41-8ac1-0b42f7c3a445', NULL, 'https://m.media-amazon.com/images/I/71SjhIm98SL._UF350,350_QL80_.jpg', 0, true, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-24T08:52:37.479279+00:00')
ON CONFLICT DO NOTHING;
