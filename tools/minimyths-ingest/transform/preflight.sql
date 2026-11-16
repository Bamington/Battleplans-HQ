select
  (select count(*) from public.battlepacks)      as packs_now,
  (select count(*) from public.battlepack_slugs) as slugs_now,
  (select count(*) from public.locations where id in (
     '9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b401','9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b402',
     '9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b403','9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b404',
     '9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b405'))    as venues_already_there,
  (select count(*) from auth.users
     where id = 'c0fab326-f180-4fe6-bf1b-87c069be3794') as owner_exists;
