-- =====================================================================================
--  RR-4 — certificate document immutability
-- =====================================================================================
--  Three independent locks, asserted here:
--    1. the `certificates` bucket has NO client storage policy (checked directly)
--    2. `media_assets.content_hash` records the bytes at issuance
--    3. WRITE-ONCE — once an asset backs a certificate, its storage_key and
--       content_hash can never change, and it cannot be deleted
--
--  A credential whose document can be swapped after issuance is not a credential.
--  If this test fails, that property is gone.
-- =====================================================================================
do $test$
declare
  v_admin uuid; v_stu uuid := gen_random_uuid();
  v_course uuid; v_cohort uuid; v_app uuid; v_enr uuid; v_clr uuid; v_cert uuid;
  v_media uuid; v_media2 uuid; v_hash text; v_policies int;
  v_err text; v_stage text := 'setup';
begin
  select id into v_admin from public.users
   where id in (select ur.user_id from public.user_roles ur
                  join public.roles r on r.id = ur.role_id
                 where r.code = 'ADMIN' and ur.revoked_at is null) limit 1;
  if v_admin is null then raise exception 'PRECONDITION: no ADMIN user exists'; end if;

  ------------------------------------------------------------------ lock 1
  -- The private bucket must remain unreachable by any client role. The ABSENCE of a
  -- policy is the enforcement; a well-meaning future "fix" would break RR-4 silently.
  v_stage := 'bucket_has_no_client_policy';
  select count(*) into v_policies
    from pg_policies p
   where p.schemaname = 'storage' and p.tablename = 'objects'
     and p.qual ilike '%certificates%';
  if v_policies > 0 then
    raise exception 'BREACH: a storage policy now references the certificates bucket (RR-4). '
      'Delivery must be by signed URL only.';
  end if;

  ------------------------------------------------------------------ build a certificate
  v_stage := 'issue_certificate';
  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values (v_stu,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t10@probe.invalid',null,now(),now(),now());

  insert into public.courses (code,title_ar,title_en,track,level,status)
  values ('T10-C','دورة','Probe','AI','BEGINNER','PUBLISHED') returning id into v_course;
  insert into public.cohorts (course_id,code,capacity,status)
  values (v_course,'T10-CH',5,'RUNNING') returning id into v_cohort;
  insert into public.applications (cohort_id,applicant_user_id,status)
  values (v_cohort,v_stu,'ENROLLED') returning id into v_app;
  insert into public.enrollments (application_id,cohort_id,student_user_id,status,completed_at)
  values (v_app,v_cohort,v_stu,'COMPLETED',now()) returning id into v_enr;
  insert into public.clearance_records (enrollment_id,status,approved_by,approved_at)
  values (v_enr,'APPROVED',v_admin,now()) returning id into v_clr;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  v_cert := (public.issue_certificate(v_enr) ->> 'certificate_id')::uuid;

  ------------------------------------------------------------------ lock 2
  v_stage := 'attach_document';
  v_hash := encode(extensions.digest('probe certificate bytes', 'sha256'), 'hex');
  v_media := public.attach_certificate_document(
    v_cert, 'certificates/' || v_cert || '.pdf', v_hash, 12345, 'application/pdf');

  if (select content_hash from public.media_assets where id = v_media) <> lower(v_hash) then
    raise exception 'BREACH: the content hash was not recorded';
  end if;
  if (select document_media_id from public.certificates where id = v_cert) <> v_media then
    raise exception 'BREACH: the document was not linked to the certificate';
  end if;

  v_stage := 'hash_must_be_sha256_length';
  begin
    perform public.attach_certificate_document(v_cert, 'x', 'tooshort', 1);
    raise exception 'BREACH: a malformed content hash was accepted';
  exception when others then
    if sqlerrm not like '%DOCUMENT_ALREADY_ATTACHED%'
       and sqlerrm not like '%INVALID_CONTENT_HASH%' then raise; end if;
  end;

  v_stage := 'one_document_per_certificate';
  begin
    perform public.attach_certificate_document(
      v_cert, 'certificates/' || v_cert || '-v2.pdf',
      encode(extensions.digest('different bytes', 'sha256'), 'hex'), 999);
    raise exception 'BREACH: a second document was attached to one certificate';
  exception when others then
    if sqlerrm not like '%DOCUMENT_ALREADY_ATTACHED%' then raise; end if;
  end;

  ------------------------------------------------------------------ lock 3
  v_stage := 'storage_key_is_write_once';
  begin
    update public.media_assets set storage_key = 'certificates/swapped.pdf' where id = v_media;
    raise exception 'BREACH: the stored document of an issued certificate was swapped (RR-4)';
  exception when others then
    if sqlerrm not like '%CERTIFICATE_DOCUMENT_IMMUTABLE%' then raise; end if;
  end;

  v_stage := 'content_hash_is_write_once';
  begin
    update public.media_assets
       set content_hash = encode(extensions.digest('forged', 'sha256'), 'hex')
     where id = v_media;
    raise exception 'BREACH: the recorded hash was rewritten to match forged bytes (RR-4)';
  exception when others then
    if sqlerrm not like '%CERTIFICATE_DOCUMENT_IMMUTABLE%' then raise; end if;
  end;

  v_stage := 'document_cannot_be_deleted';
  begin
    delete from public.media_assets where id = v_media;
    raise exception 'BREACH: the document backing an issued certificate was deleted (RR-4)';
  exception when others then
    if sqlerrm not like '%CERTIFICATE_DOCUMENT_IMMUTABLE%'
       and sqlerrm not like '%violates foreign key%' then raise; end if;
  end;

  ------------------------------------------------------------------ unrelated media stays editable
  v_stage := 'ordinary_media_still_editable';
  insert into public.media_assets (storage_key, mime_type, byte_size, usage_rights)
  values ('media/ordinary.png', 'image/png', 10, 'CLUB_OWNED') returning id into v_media2;
  update public.media_assets set storage_key = 'media/renamed.png' where id = v_media2;
  if (select storage_key from public.media_assets where id = v_media2) <> 'media/renamed.png' then
    raise exception 'BREACH: the write-once lock leaked onto ordinary media assets';
  end if;

  raise exception 'ALL_RR4_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_RR4_PASSED' then raise exception 'ALL_RR4_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
