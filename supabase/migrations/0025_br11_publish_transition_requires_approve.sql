set search_path = public, extensions, pg_catalog;

-- =====================================================================================
--  Migration 0025 — BR-11 / D-08: publishing requires APPROVE, not merely UPDATE.
-- =====================================================================================
--  THE GAP (found by the pre-build audit for the M7/M8/M9 authoring UI, PROVEN):
--    `staff_update` on projects/events/articles/galleries/awards is
--        USING app.has_perm('M7.UPDATE')   -- and the M8/M9 equivalents
--    with NO column restriction. So anyone who may EDIT a row may also flip
--    `publication_status` to PUBLISHED and put it on the public site.
--
--    Proven: a user granted M7.READ/CREATE/UPDATE and explicitly NOT M7.APPROVE
--    published a project. No error. The only thing that briefly stopped it was
--    `ck_project_published_stamped`, which is a data-integrity check — supplying
--    `published_at` by hand satisfied it and the publish went through. The other four
--    entities have no such check at all.
--
--  Why it is not exploitable TODAY: in the seed, every role holding UPDATE for a module
--  also holds APPROVE for it (PROJECTS, EVENTS, MEDIA). So the distinction has never
--  been tested. It becomes exploitable the moment the club adds a drafting role — a
--  junior member writes, a lead publishes — which is exactly what an authoring UI
--  invites. The permission model already draws the line; nothing enforced it.
--
--  This is D-13's shape once more: a table holding a column its row-editor must not
--  write. The established remedies are a column GRANT or an RPC-only write path; here a
--  trigger is the better fit, because publishing is a TRANSITION (old value → new
--  value), which a column privilege cannot see.
-- =====================================================================================

create or replace function app.assert_publish_authorised()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
  v_module text := tg_argv[0];
  v_old public.publication_status;
begin
  v_old := case when tg_op = 'UPDATE' then old.publication_status else null end;

  -- Only a CHANGE of publication status is gated. Ordinary edits to a draft — or to an
  -- already-published row — stay open to anyone with UPDATE, which is the point of
  -- having a drafting role at all.
  if tg_op = 'UPDATE' and new.publication_status is not distinct from v_old then
    return new;
  end if;

  -- DRAFT is the safe resting state: creating or returning something to draft is not
  -- publication and must not require APPROVE, or a drafter could not withdraw their own
  -- mistake.
  if new.publication_status in ('DRAFT', 'PENDING_REVIEW') then
    return new;
  end if;

  if not (app.has_perm(v_module || '.APPROVE') or app.is_admin()) then
    raise exception 'PUBLISH_REQUIRES_APPROVE: % is needed to move % out of draft',
      v_module || '.APPROVE', tg_table_name
      using errcode = '42501';
  end if;

  -- Stamp the publication server-side. Previously the caller supplied `published_at`
  -- themselves to satisfy ck_project_published_stamped, so the stamp recorded whatever
  -- they typed. A timestamp that can be dictated by the client is not evidence.
  if new.publication_status = 'PUBLISHED' then
    if v_old is distinct from 'PUBLISHED' or new.published_at is null then
      new.published_at := now();
    end if;
  end if;

  return new;
end $fn$;

comment on function app.assert_publish_authorised() is
  'BR-11/D-08. Gates the publication_status TRANSITION on <module>.APPROVE and stamps '
  'published_at server-side. A trigger rather than a column grant because the rule is '
  'about the change, not the column: editing a published row is fine, changing whether '
  'it is published is not.';

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('projects',   'M7'),
      ('events',     'M8'),
      ('articles',   'M9'),
      ('galleries',  'M9'),
      ('awards',     'M9')
    ) as t(tbl, module)
  loop
    execute format(
      'drop trigger if exists trg_publish_authorised on public.%I', r.tbl);
    execute format(
      'create trigger trg_publish_authorised
         before insert or update of publication_status on public.%I
         for each row execute function app.assert_publish_authorised(%L)',
      r.tbl, r.module);
  end loop;
end $$;
