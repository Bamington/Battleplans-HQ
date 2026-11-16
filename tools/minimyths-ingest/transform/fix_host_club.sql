-- Set the host club on the 89 imported archive packs.
--
-- host_location_id is the CLUB running the event; location_id is only ever
-- where it happened. The read policy on battlepacks grants access through
-- EITHER, so a pack held at a venue the organiser does not administer, with
-- no host club, is invisible to that organiser -- which is why all 89 were
-- missing from My BattlePacks under the Mini Myths context.
--
-- Every event in this archive is a Mini Myths event: that is the filter the
-- source snapshot was taken under.
--
-- Scoped to the 89 imported ids explicitly, so no pre-existing pack is
-- touched. Safe to re-run.

begin;

update public.battlepacks
   set host_location_id = '53809c67-b6a5-4ebc-8941-9c14da626d5a'
 where host_location_id is null
   and id in (
    'eff6f23a-7691-5ef7-8110-200980d39f3b',
    '635558ff-0ad9-5d36-8a75-484d07479a68',
    '6f504156-a0cc-56e2-90a9-64264d1a114d',
    '3efbd516-f997-5ed1-ad27-00f230762027',
    '4e732ee6-45f5-5e15-b8b5-dae68245324a',
    '28e9265e-1eae-5239-af8c-1d9e74146c8a',
    '5bbc94b9-e7ee-5aac-8c6e-f9a03b2b5ef0',
    'a6572107-db97-54a5-9856-cdd3ccac4847',
    'c6cc8612-9614-5f2e-801f-4c4e4ac17afe',
    '14a423a0-774b-5635-ae72-f682efd09d3e',
    '51a2e030-d326-55ee-b15c-20360eab6c45',
    '792f03bf-1111-55c6-ad12-48fa7f1659d4',
    '888d6668-e68d-5bc6-9d1a-4aabe66ec62d',
    '400a34c0-5906-5f6d-bb43-abf85a384ec2',
    'e34b250b-b352-5f4e-a339-a74b38c175e2',
    '9dce3e67-34e4-53f0-805c-b9a3d9418a5e',
    '13e3b77f-7e83-5c1a-9e53-34abe05f8b39',
    '73b5eb5e-ae99-561b-809a-fa5149604adc',
    '3e73349b-aa0d-5dd1-be5e-38f30112a5e8',
    'f66ef0b1-dca6-58a1-9cb5-c5b31c6a543f',
    '3fd62d55-6da0-549f-a5cb-ca0e7987f7cc',
    'd34552db-74bd-5786-93f1-fd3af2c1bb8d',
    'e2b173e0-74ea-5f07-8aa5-e7fa5c2f6fa0',
    'a47fe4bb-528a-578a-b17e-6af52fe5ab9e',
    '6e7bebca-67b5-55a6-8df4-e6716730e21b',
    'b394cbf6-462c-59e2-9459-ffda02351eda',
    '4516575f-6f93-5c7b-aca2-6ab8f785bd7b',
    '0846c1b5-cc82-548e-9683-491dc457b9ad',
    '5b1d5833-7ffd-5212-ab6b-f377a509848e',
    '9c1fce60-4bd8-527e-872d-271c2276e527',
    '61155f6f-b483-53b8-bfee-b56519581c35',
    'cadd9c8d-8969-5608-aa7e-892ba343cfcd',
    '0689aae4-28e3-5feb-84d5-2e46dfcb9248',
    'cfa675d6-9aba-57d4-81fe-e07846038fca',
    '203089cb-7146-5b40-9ab9-a56e45cfd6bd',
    'ee9ec697-66c4-55b8-b03d-111165e75df0',
    'eafaaf8d-9bb7-59aa-8ee9-d6622f725ffb',
    '40d98c53-60ea-5859-b0a4-b70bb6a7cbf6',
    '1aaae56a-0644-530c-b945-f8973af5b9e2',
    '4af5c162-4401-5b4a-b019-f38b205ce2ad',
    '79ea8a2d-4ae8-5c74-b188-3428e174e713',
    'f0c59050-29bb-5e2f-84dd-9670bf03c225',
    'c32b0b59-065b-5492-9a7b-758d3fe547e7',
    '4428c002-4968-5f99-b5ff-560fb2c7d0e8',
    '9260ef55-9b60-58cc-aa91-fc58b75e56c7',
    '12935b12-c90d-5350-88fa-07eab3e816f1',
    'ca69e0c6-2225-588d-b2f8-a1d71c4486ab',
    '9427736e-f743-5858-97e7-b79eebc85b4a',
    '33be643b-d3f6-56f7-af0f-e3998e0e673a',
    'af803076-2cd8-5af9-ad66-0578b044d461',
    '8b72a188-d97d-5501-bbbc-9280612a795f',
    '64777641-28df-51da-932d-c71b666b52dc',
    '66a81c97-3bab-50e8-aeb1-1ca85580b05e',
    '959f1d2d-041d-5804-9b89-256bcfd53155',
    '74f715e5-f06d-54af-a1d0-f5b996763b9f',
    '719bd904-2f1b-5b18-ac16-9292609a2301',
    'b998b5ac-103f-546e-86a6-151c803c6969',
    '6136343b-518c-55af-b215-2095740cfbde',
    '2e3b8a07-c346-5f3b-8b84-971717571595',
    '0b09f6dd-fa45-5a1e-b4b4-966dbd45697d',
    '955e8eb5-e164-5e4e-b291-bddd35d6be90',
    'd3112657-ff86-5b87-b71a-4233ae308816',
    'a01192de-85c5-5eba-9b51-26e2ff9b6113',
    'f57a3853-4d69-572f-9736-17d154c9a37a',
    '63b4a3f6-ba54-5755-b289-9294cc9cec83',
    '10e711a9-ba2f-5da5-89d5-5e9704da5c19',
    '9fa1f52c-dd44-50a6-9dd8-47b99b38fe48',
    'ab667366-90b9-577a-a05b-62823b27c3db',
    '5af0ae79-a15d-5799-a30d-fb78951d4f0e',
    'a1fb177a-f01e-5040-8859-521e034d9e9a',
    '80b0cc46-fe28-5f0b-8161-39f6e9ea25e5',
    'c99fb184-33c5-5714-a2a5-cc965816f3e8',
    'd1267aee-f387-5fd0-adfa-f8f497c4af7e',
    'a023a6ec-2ab6-55d0-94a9-0b1634b3cf75',
    '3bb34648-9da9-5e9b-b21a-a274cb21248a',
    '946519e2-f69e-51f6-afe1-7065e8f0795c',
    'fac0ce91-b970-5486-9909-9f1ad6bb2dcc',
    'f7fd5587-107f-52da-b62d-5f4b9653d366',
    'd1af7ab1-4c40-548a-8f68-f9c90c21df5b',
    '6aaa427b-67b0-5a5b-a219-803ace7f96d1',
    'b46f7193-7c92-51fd-9218-5ed17ee0a9a0',
    '64d804b9-8c60-5bd0-9df1-2bc213d24f9f',
    '84e3d455-6ab5-50c9-a6d7-f3987c9497c3',
    '9dc19591-2284-576a-a8dd-b116f39ed7f8',
    '24782c81-94a5-54cc-9940-2c75e1464b81',
    'a75b4e5e-c833-5096-8da8-7b84427b802f',
    '757e916a-3cfc-5183-af43-e777edab306d',
    '2e403025-3a3d-5214-b10f-db4d213b7a1a',
    '4ef11e05-f685-58ac-81f0-2b66488b5be6'
);

commit;

-- verification, expect 89:
-- select count(*) from public.battlepacks
--   where host_location_id = '53809c67-b6a5-4ebc-8941-9c14da626d5a';
