-- =====================================================================================
--  DEMO CONTENT — FICTIONAL. Authorised by the club (Session 008) to unblock M2 and the
--  authoring UI ahead of the team meeting that will supply the real records.
-- =====================================================================================
--  EVERYTHING THIS CREATES IS FAKE and is designed to be purged in one step. Two markers
--  make that possible, and nothing here writes a row without one of them:
--
--      auth.users.email  LIKE '%@demo.hamak.invalid'   ← trainers
--      projects.code     LIKE 'DEMO-%'                 ← projects
--
--  `.invalid` is reserved by RFC 2606 and can never be a real address, so these can
--  never collide with a genuine club member.
--
--  Run `demo_content_CLEANUP.sql` to remove all of it. Technologies are handled
--  separately there, because Arduino/ESP32/Python are real names the club will keep.
--
--  THE TRAINER IDENTITIES HAVE NO PASSWORD. They exist so M2 has someone to match
--  against; they cannot be signed into. Creating usable credentials is account creation
--  and stays a human action — the same line held for the admin bootstrap in Session 001.
--  If these people need to log in later, a human sets the passwords.
--
--  Safe to re-run: every insert is guarded, so a second run changes nothing.
-- =====================================================================================
do $seed$
declare
  v_admin   uuid;
  v_layla   uuid; v_omar uuid; v_rana uuid; v_samer uuid;
  v_parking uuid; v_face uuid; v_irrigation uuid;

begin
  select ur.user_id into v_admin
    from public.user_roles ur join public.roles r on r.id = ur.role_id
   where r.code = 'ADMIN' and ur.revoked_at is null
   limit 1;
  if v_admin is null then raise exception 'PRECONDITION: no ADMIN user exists'; end if;

  -- Act as the admin for the whole seed. This is not cosmetic: the D-22 trigger gates
  -- the publish transition on <module>.APPROVE and would refuse an unauthenticated
  -- insert, so seeding this way exercises the real authorisation path rather than
  -- sidestepping it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);

  -- ------------------------------------------------------------------ technologies
  -- Real names, supplied by the club. Kept out of the cleanup by default.
  insert into public.technologies (name, category)
  select v.name, v.category
    from (values
      ('Arduino',      'Microcontroller'),
      ('ESP32',        'Microcontroller'),
      ('ESP32-CAM',    'Microcontroller'),
      ('Raspberry Pi', 'Single-board computer'),
      ('Python',       'Language'),
      ('OpenCV',       'Library'),
      ('Flask',        'Framework')
    ) as v(name, category)
   where not exists (select 1 from public.technologies t where t.name = v.name);

  -- ------------------------------------------------------------------ trainers
  -- Password-less identities. `email_confirmed_at` is set so the bridge trigger builds
  -- the public.users profile, but with no encrypted_password there is nothing to sign
  -- in with.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_user_meta_data
  )
  select gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
         'authenticated', 'authenticated', v.email, null,
         now(), now(), now(),
         jsonb_build_object(
           'full_name_ar', v.name_ar,
           'full_name_en', v.name_en,
           'user_type', 'MEMBER',
           'locale', 'ar')
    from (values
      ('layla.haddad@demo.hamak.invalid', 'ليلى حداد',  'Layla Haddad'),
      ('omar.nasser@demo.hamak.invalid',  'عمر ناصر',   'Omar Nasser'),
      ('rana.khoury@demo.hamak.invalid',  'رنا خوري',   'Rana Khoury'),
      ('samer.aziz@demo.hamak.invalid',   'سامر عزيز',  'Samer Aziz')
    ) as v(email, name_ar, name_en)
   where not exists (select 1 from auth.users a where a.email = v.email);

  select id into v_layla from public.users where email = 'layla.haddad@demo.hamak.invalid';
  select id into v_omar  from public.users where email = 'omar.nasser@demo.hamak.invalid';
  select id into v_rana  from public.users where email = 'rana.khoury@demo.hamak.invalid';
  select id into v_samer from public.users where email = 'samer.aziz@demo.hamak.invalid';

  -- The bridge trigger may not read user_type from metadata on every path, so make the
  -- member status explicit rather than assuming.
  update public.users
     set user_type = 'MEMBER', status = 'ACTIVE'
   where id in (v_layla, v_omar, v_rana, v_samer);

  -- ------------------------------------------------------------------ expertise (D-06)
  -- NOTE: is_available is set TRUE here. In the real flow the member opts in themselves
  -- (D-06) — but with nothing available `suggest_experts` returns no candidate and M2
  -- stays inert, which is exactly what this seed exists to unblock.
  insert into public.member_expertise
    (member_user_id, expertise_domain_id, proficiency, is_available, max_concurrent_load, curated_by)
  select v.member, d.id, v.proficiency::expertise_proficiency, true, v.cap, v_admin
    from (values
      (v_layla, 'AI',          'EXPERT',     3),
      (v_layla, 'VIBE_CODING', 'PROFICIENT', 3),
      (v_omar,  'ARDUINO',     'EXPERT',     4),
      (v_omar,  'PCB',         'PROFICIENT', 4),
      (v_rana,  'PRINTING_3D', 'EXPERT',     2),
      (v_rana,  'ARDUINO',     'FAMILIAR',   2),
      (v_samer, 'VIBE_CODING', 'EXPERT',     3),
      (v_samer, 'AI',          'PROFICIENT', 3)
    ) as v(member, domain_code, proficiency, cap)
    join public.expertise_domains d on d.code = v.domain_code
   where v.member is not null
     and not exists (
       select 1 from public.member_expertise me
        where me.member_user_id = v.member and me.expertise_domain_id = d.id);

  -- ------------------------------------------------------------------ projects
  -- ⚠ BILINGUAL LIMITATION, found by rendering these pages.
  -- `abstract` and `problem_statement` are SINGLE columns: no `_ar`/`_en` pair, and no
  -- `translation_group_id` as articles have. So a project's long-form text can exist in
  -- only ONE language, and both locales render the same string. Everything here is
  -- therefore Arabic, the default locale.
  --
  -- The first draft of this seed put Arabic in `abstract` and English in
  -- `problem_statement`, which accidentally hid the gap behind a coincidentally-English
  -- field. It is recorded as an open question for the club instead — changing the schema
  -- needs a D- decision (claude.md §0.1).
  insert into public.projects
    (code, title_ar, title_en, abstract, problem_statement, status, start_on, publication_status, created_by)
  select v.code, v.title_ar, v.title_en, v.abstract, v.problem, v.status::project_status,
         v.start_on::date, 'DRAFT', v_admin
    from (values
      ('DEMO-PARK',
       'مرآب سيارات ذكي آلي',
       'Automated Smart Parking Garage',
       'مرآب متعدد الطوابق يتعرّف على لوحات المركبات آليًا عند البوابة، ويوجّه السائق إلى أقرب موقف شاغر بالاعتماد على حسّاسات فوق صوتية في كل موقف، ويحتسب المدة والرسوم تلقائيًا عند الخروج.',
       'تضيع في مرائب الجامعة دقائق طويلة بحثًا عن موقف شاغر، ولا توجد وسيلة لمعرفة الأماكن المتاحة قبل الدخول، ما يسبب ازدحامًا عند البوابة في ساعات الذروة.',
       'IN_PROGRESS', '2026-03-02'),
      ('DEMO-FACE',
       'نموذج أولي للتعرّف على الوجوه',
       'AI Facial Recognition Prototype',
       'نموذج أولي للتحقق من هوية أعضاء النادي عند مدخل المختبر، يعمل على حاسب أحادي اللوحة مع كاميرا، ويقارن الوجه بقاعدة محلية دون إرسال أي صورة إلى الخارج.',
       'يعتمد الدخول إلى المختبر حاليًا على بطاقات تُنسى أو تُعار، ولا يوجد سجل موثوق لمن دخل ومتى.',
       'IDEA', '2026-04-13'),
      ('DEMO-IRRIG',
       'نظام ريّ ذكي',
       'Smart Irrigation Controller',
       'وحدة تحكّم بالريّ تقرأ رطوبة التربة ودرجة الحرارة وتفتح صمّامات الريّ عند الحاجة فقط، مع لوحة متابعة بسيطة عبر الويب.',
       'يجري ريّ حديقة الكلية يدويًا وبمواعيد ثابتة، فتُهدر المياه في الأيام الممطرة وتجفّ التربة في الأيام الحارة.',
       'COMPLETED', '2025-10-05')
    ) as v(code, title_ar, title_en, abstract, problem, status, start_on)
   where not exists (select 1 from public.projects p where p.code = v.code);

  select id into v_parking     from public.projects where code = 'DEMO-PARK';
  select id into v_face        from public.projects where code = 'DEMO-FACE';
  select id into v_irrigation  from public.projects where code = 'DEMO-IRRIG';

  -- ------------------------------------------------------------------ teams (D-23)
  -- Membership grants the BR-12 right to raise requisitions against the project, so it
  -- is admin/manager/LEAD-only. Seeding as the admin is the sanctioned bootstrap path.
  insert into public.project_members (project_id, user_id, role_in_project, contribution_note)
  select v.project, v.member, v.role::project_member_role, v.note
    from (values
      (v_parking, v_omar,  'LEAD',          'Gate hardware, sensors and wiring'),
      (v_parking, v_layla, 'ML',            'Plate recognition pipeline'),
      (v_parking, v_samer, 'FIRMWARE',      'Bay controller firmware'),
      (v_face,    v_layla, 'LEAD',          'Recognition model and evaluation'),
      (v_face,    v_samer, 'DOCUMENTATION', 'Setup guide and privacy notes'),
      (v_irrigation, v_rana, 'LEAD',        'Enclosure design and printing'),
      (v_irrigation, v_omar, 'HARDWARE',    'Sensor board and valve driver')
    ) as v(project, member, role, note)
   where v.project is not null and v.member is not null
     and not exists (
       select 1 from public.project_members pm
        where pm.project_id = v.project and pm.user_id = v.member);

  -- ------------------------------------------------------------------ technology tags
  insert into public.project_technologies (project_id, technology_id)
  select v.project, t.id
    from (values
      (v_parking, 'ESP32'),        (v_parking, 'ESP32-CAM'),
      (v_parking, 'Python'),       (v_parking, 'OpenCV'),
      (v_parking, 'Raspberry Pi'),
      (v_face, 'Raspberry Pi'),    (v_face, 'Python'),
      (v_face, 'OpenCV'),          (v_face, 'Flask'),
      (v_irrigation, 'Arduino'),   (v_irrigation, 'ESP32'),
      (v_irrigation, 'Flask')
    ) as v(project, tech_name)
    join public.technologies t on t.name = v.tech_name
   where v.project is not null
     and not exists (
       select 1 from public.project_technologies pt
        where pt.project_id = v.project and pt.technology_id = t.id);

  -- ------------------------------------------------------------------ publish (BR-11)
  -- Done as a separate transition, exactly as the UI does it. The D-22 trigger checks
  -- M7.APPROVE and stamps published_at itself, so no timestamp is supplied here.
  update public.projects
     set publication_status = 'PUBLISHED'
   where code in ('DEMO-PARK', 'DEMO-IRRIG')
     and publication_status <> 'PUBLISHED';

  -- DEMO-FACE stays a DRAFT on purpose: the staff list is only meaningful if it has
  -- something in both columns.

  raise notice 'demo content seeded';
end $seed$;
