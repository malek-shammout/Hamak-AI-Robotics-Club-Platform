-- =====================================================================================
--  PURGE THE DEMO CONTENT seeded by demo_content.sql
-- =====================================================================================
--  Run this when the real records are ready. It removes ONLY rows carrying a demo
--  marker, and it tells you what it removed.
--
--      auth.users.email  LIKE '%@demo.hamak.invalid'   ← trainers
--      projects.code     LIKE 'DEMO-%'                 ← projects
--
--  `.invalid` is reserved by RFC 2606, so the trainer filter can never match a real
--  member's address. The project filter is anchored to the `DEMO-` code prefix.
--
--  WHAT IT DELIBERATELY DOES NOT TOUCH
--    - technologies (Arduino, ESP32, Python …) — real names the club will keep. There
--      is an OPTIONAL block at the bottom if you want them gone too.
--    - expertise_domains — seeded from the club's own course-track vocabulary, not
--      fictional. Retire one from /staff/expertise if it is unwanted.
--    - Any real account, project or consultation.
--
--  DRY RUN FIRST. Section 0 counts what WOULD be removed and changes nothing, so you can
--  read it before committing to anything.
-- =====================================================================================

-- ------------------------------------------------------------------ 0. DRY RUN
-- Run this on its own first. It only counts.
select 'demo trainers'        as what, count(*) as rows_to_delete
  from public.users where email like '%@demo.hamak.invalid'
union all
select 'demo projects', count(*) from public.projects where code like 'DEMO-%'
union all
select 'their team rows', count(*) from public.project_members pm
  join public.projects p on p.id = pm.project_id where p.code like 'DEMO-%'
union all
select 'their technology tags', count(*) from public.project_technologies pt
  join public.projects p on p.id = pt.project_id where p.code like 'DEMO-%'
union all
select 'their curated expertise', count(*) from public.member_expertise me
  join public.users u on u.id = me.member_user_id
 where u.email like '%@demo.hamak.invalid'
union all
select 'consultations involving them (BLOCKS deletion)', count(*)
  from public.consultation_requests cr
  join public.users u on u.id = cr.requester_user_id
 where u.email like '%@demo.hamak.invalid';

-- ------------------------------------------------------------------ 1. THE PURGE
-- Wrapped in a transaction and reports counts. If anything looks wrong, ROLLBACK.
begin;

-- Children first. project_media and project_bom_lines are included for completeness even
-- though the seed creates none — a later hand-edit might have.
delete from public.project_media
 where project_id in (select id from public.projects where code like 'DEMO-%');

delete from public.project_bom_lines
 where project_id in (select id from public.projects where code like 'DEMO-%');

delete from public.project_technologies
 where project_id in (select id from public.projects where code like 'DEMO-%');

delete from public.project_members
 where project_id in (select id from public.projects where code like 'DEMO-%');

delete from public.projects where code like 'DEMO-%';

-- The demo members' curated expertise, and anything they were assigned to advise on.
delete from public.consultation_assignments
 where expert_user_id in (
   select id from public.users where email like '%@demo.hamak.invalid');

delete from public.member_expertise
 where member_user_id in (
   select id from public.users where email like '%@demo.hamak.invalid');

-- Finally the identities. Deleting from auth.users cascades to public.users through the
-- FK added in D-10, so the profile goes with it.
delete from auth.users where email like '%@demo.hamak.invalid';

-- Confirm nothing demo-marked survives. All four must read 0.
select 'projects left'   as what, count(*) as remaining from public.projects where code like 'DEMO-%'
union all
select 'auth identities left', count(*) from auth.users where email like '%@demo.hamak.invalid'
union all
select 'profiles left', count(*) from public.users where email like '%@demo.hamak.invalid'
union all
select 'expertise rows left', count(*) from public.member_expertise me
  join public.users u on u.id = me.member_user_id where u.email like '%@demo.hamak.invalid';

commit;
-- rollback;   -- ← use this instead if the counts above are not all zero

-- ------------------------------------------------------------------ 2. OPTIONAL
-- Only if you also want the technology list gone. Most clubs will keep it: these are
-- real tools, not fiction. It refuses to remove any technology still referenced by a
-- surviving project, so running it cannot orphan real content.
--
-- begin;
-- delete from public.technologies t
--  where t.name in ('Arduino','ESP32','ESP32-CAM','Raspberry Pi','Python','OpenCV','Flask')
--    and not exists (select 1 from public.project_technologies pt where pt.technology_id = t.id);
-- commit;
