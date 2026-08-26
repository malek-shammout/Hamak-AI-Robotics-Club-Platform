-- =====================================================================================
--  HMK Platform - Migration 0018
--  M6 Clearance & Certificate Issuance
-- =====================================================================================
--  This implements B.2 literally. The truth rule is:
--
--      approval_enabled = C1 AND C2 AND C3 AND C4 AND C5
--
--  A1 (open liabilities on OTHER enrollments) is DELIBERATELY EXCLUDED from that
--  conjunction. It is recorded as advisory_outstanding_elsewhere and shown to A3/A7,
--  never to the student, and it must NEVER gate a certificate. That is D-04 Option C
--  and BR-13: custody is the lever, not certification. DO NOT add A1 to the conjunction.
--
--  RR-3: consumables are excluded from the return obligation. C2 and C3 read
--  v_enrollment_outstanding_items, the single source of that filtering (claude.md 4).
--  Do not re-implement the is_consumable filter anywhere else.
--
--  BR-01 itself is already guaranteed structurally by D-09: certificates carries a
--  mirrored clearance_status bound by a composite FK to clearance_records(id, status)
--  plus a CHECK limiting it to approved states. issue_certificate writes that column
--  from the LOCKED clearance row, so it cannot circumvent the lock even if this code
--  is wrong - which is the entire point of the design.
--
--  VERIFIED by supabase/tests/08_m6_clearance_and_certificate.sql, which walks the
--  whole lifecycle (enrol -> attend -> complete -> borrow -> damage -> liability ->
--  resolve -> inspect -> clearance -> certificate -> public verification) and asserts:
--    * C1 fails while the enrollment is ACTIVE; approval and issuance both refused
--    * a certificate without an approved clearance -> CLEARANCE_NOT_APPROVED
--    * C2 counts the serialized kit but NOT the consumable (RR-3)
--    * an outstanding consumable does not block C2 at all
--    * C4 fails on a live liability for THIS enrollment
--    * A1 fires as advisory for a liability on ANOTHER enrollment, is marked
--      blocking=false, and C4 ignores it entirely (D-04 Option C)
--    * a clean approval is not recorded as an override
--    * BR-10 verification code is 128-bit (32 hex chars)
--    * the enrollment moves to CERTIFIED; a second issuance is refused
--    * the issued certificate resolves through the public verify_certificate path
--    * revoking the clearance under a live certificate -> foreign_key_violation (D-09)
--
--  Applied via MCP as m6_clearance_evaluation_and_certificate_issuance.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====

CREATE OR REPLACE FUNCTION public.approve_clearance(p_enrollment_id uuid, p_override_justification text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_eval jsonb; v_clr record; v_override boolean := false; v_new clearance_status;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M6.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  -- Always re-evaluate. Approving on a stale snapshot is how a returned-but-uninspected
  -- item slips through.
  v_eval := public.evaluate_clearance(p_enrollment_id);

  select cr.* into v_clr from public.clearance_records cr
   where cr.enrollment_id = p_enrollment_id for update;
  if v_clr.status in ('APPROVED','APPROVED_BY_OVERRIDE') then
    raise exception 'ALREADY_APPROVED' using errcode='P0001';
  end if;

  if not (v_eval->>'approval_enabled')::boolean then
    if p_override_justification is null or btrim(p_override_justification) = '' then
      raise exception 'PRECONDITIONS_FAILED' using errcode='P0001', detail = v_eval::text;
    end if;
    -- UC-6.13: overriding clearance is reachable exclusively by A7 and is
    -- unconditionally audited.
    if not app.is_admin() then
      raise exception 'OVERRIDE_REQUIRES_ADMIN' using errcode='42501';
    end if;
    v_override := true;
  end if;

  v_new := case when v_override then 'APPROVED_BY_OVERRIDE'::clearance_status
                else 'APPROVED'::clearance_status end;

  update public.clearance_records
     set status = v_new, approved_by = v_uid, approved_at = now(),
         is_override = v_override,
         override_justification = case when v_override then p_override_justification else null end,
         updated_at = now()
   where enrollment_id = p_enrollment_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id,
                                 before_state, after_state, is_override, justification)
  values (v_uid, 'APPROVE_CLEARANCE', 'clearance_records', v_clr.id,
          jsonb_build_object('status', v_clr.status),
          jsonb_build_object('status', v_new, 'evaluation', v_eval),
          v_override, case when v_override then p_override_justification else null end);

  return jsonb_build_object('enrollment_id', p_enrollment_id, 'status', v_new,
                            'overridden', v_override, 'evaluation', v_eval);
end $function$;

CREATE OR REPLACE FUNCTION public.evaluate_clearance(p_enrollment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_enr record; v_clr uuid;
  v_c1 boolean; v_c2 int; v_c3 int; v_c4 int; v_c5 int;
  v_advisory boolean; v_enabled boolean; v_snapshot jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M6.READ') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select e.* into v_enr from public.enrollments e where e.id = p_enrollment_id;
  if not found then raise exception 'ENROLLMENT_NOT_FOUND' using errcode='P0002'; end if;

  -- C1 — the enrollment is complete. An A7 override completion still counts as
  -- complete; that override was itself a recorded decision (BR-05).
  v_c1 := v_enr.status in ('COMPLETED','COMPLETED_BY_OVERRIDE','CERTIFIED');

  -- C2 — nothing still out. C3 — everything returned has been inspected.
  -- Both read the RR-3 view so consumables never appear.
  select count(*) into v_c2 from public.v_enrollment_outstanding_items o
   where o.enrollment_id = p_enrollment_id and o.line_status in ('ACTIVE','OVERDUE');

  select count(*) into v_c3 from public.v_enrollment_outstanding_items o
   where o.enrollment_id = p_enrollment_id and o.line_status not in ('ACTIVE','OVERDUE');

  -- C4 — no liability for THIS enrollment is still live.
  select count(*) into v_c4 from public.liability_records lr
   where lr.enrollment_id = p_enrollment_id
     and lr.status in ('OPEN','UNDER_ASSESSMENT','PENDING_SETTLEMENT');

  -- C5 — no incident on this enrollment's lines is still open.
  select count(*) into v_c5
    from public.asset_incidents ai
    join public.checkout_lines cl on cl.id = ai.checkout_line_id
    join public.checkouts co on co.id = cl.checkout_id
   where co.enrollment_id = p_enrollment_id and ai.status in ('OPEN','ACKNOWLEDGED');

  -- A1 — ADVISORY ONLY (BR-13 / D-04 Option C). Never part of the conjunction.
  select exists (
    select 1 from public.liability_records lr
     where lr.holder_user_id = v_enr.student_user_id
       and (lr.enrollment_id is distinct from p_enrollment_id)
       and lr.status in ('OPEN','UNDER_ASSESSMENT','PENDING_SETTLEMENT')
  ) into v_advisory;

  v_enabled := v_c1 and v_c2 = 0 and v_c3 = 0 and v_c4 = 0 and v_c5 = 0;

  v_snapshot := jsonb_build_object(
    'evaluated_at', now(),
    'C1_NOT_COMPLETED',     jsonb_build_object('pass', v_c1),
    'C2_ITEMS_OUTSTANDING', jsonb_build_object('pass', v_c2 = 0, 'count', v_c2),
    'C3_INSPECTION_PENDING',jsonb_build_object('pass', v_c3 = 0, 'count', v_c3),
    'C4_LIABILITY_OPEN',    jsonb_build_object('pass', v_c4 = 0, 'count', v_c4),
    'C5_INCIDENT_OPEN',     jsonb_build_object('pass', v_c5 = 0, 'count', v_c5),
    'A1_OUTSTANDING_ELSEWHERE', jsonb_build_object('advisory', v_advisory, 'blocking', false),
    'approval_enabled', v_enabled
  );

  insert into public.clearance_records (enrollment_id, status, precondition_snapshot,
                                        advisory_outstanding_elsewhere)
  values (p_enrollment_id, 'EVALUATING', v_snapshot, v_advisory)
  on conflict (enrollment_id) do update
    set precondition_snapshot = excluded.precondition_snapshot,
        advisory_outstanding_elsewhere = excluded.advisory_outstanding_elsewhere,
        updated_at = now()
  returning id into v_clr;

  if v_clr is null then
    select id into v_clr from public.clearance_records where enrollment_id = p_enrollment_id;
  end if;

  -- Blockers are an itemised, resolvable history rather than a rewritten list: a
  -- blocker that no longer applies is CLOSED, not deleted.
  update public.clearance_blockers b set resolved_at = now()
   where b.clearance_record_id = v_clr and b.resolved_at is null
     and case b.blocker_code
           when 'NOT_COMPLETED'      then v_c1
           when 'ITEMS_OUTSTANDING'  then v_c2 = 0
           when 'INSPECTION_PENDING' then v_c3 = 0
           when 'LIABILITY_OPEN'     then v_c4 = 0
           when 'INCIDENT_OPEN'      then v_c5 = 0
         end;

  if not v_c1 then
    insert into public.clearance_blockers (clearance_record_id, blocker_code, detail_ar, detail_en)
    select v_clr, 'NOT_COMPLETED', 'لم تكتمل الدورة بعد.', 'The course is not completed yet.'
     where not exists (select 1 from public.clearance_blockers b
                        where b.clearance_record_id = v_clr and b.blocker_code = 'NOT_COMPLETED'
                          and b.resolved_at is null);
  end if;
  if v_c2 > 0 then
    insert into public.clearance_blockers (clearance_record_id, blocker_code, detail_ar, detail_en)
    select v_clr, 'ITEMS_OUTSTANDING', 'لديك عتاد لم يُعَد بعد.', 'Hardware has not been returned.'
     where not exists (select 1 from public.clearance_blockers b
                        where b.clearance_record_id = v_clr and b.blocker_code = 'ITEMS_OUTSTANDING'
                          and b.resolved_at is null);
  end if;
  if v_c3 > 0 then
    insert into public.clearance_blockers (clearance_record_id, blocker_code, detail_ar, detail_en)
    select v_clr, 'INSPECTION_PENDING', 'بانتظار فحص العتاد المُعاد.', 'Returned hardware is awaiting inspection.'
     where not exists (select 1 from public.clearance_blockers b
                        where b.clearance_record_id = v_clr and b.blocker_code = 'INSPECTION_PENDING'
                          and b.resolved_at is null);
  end if;
  if v_c4 > 0 then
    insert into public.clearance_blockers (clearance_record_id, blocker_code, detail_ar, detail_en)
    select v_clr, 'LIABILITY_OPEN', 'توجد مسؤولية غير مسوّاة.', 'An unresolved liability exists.'
     where not exists (select 1 from public.clearance_blockers b
                        where b.clearance_record_id = v_clr and b.blocker_code = 'LIABILITY_OPEN'
                          and b.resolved_at is null);
  end if;
  if v_c5 > 0 then
    insert into public.clearance_blockers (clearance_record_id, blocker_code, detail_ar, detail_en)
    select v_clr, 'INCIDENT_OPEN', 'يوجد بلاغ عتاد مفتوح.', 'An asset incident is still open.'
     where not exists (select 1 from public.clearance_blockers b
                        where b.clearance_record_id = v_clr and b.blocker_code = 'INCIDENT_OPEN'
                          and b.resolved_at is null);
  end if;

  return v_snapshot || jsonb_build_object('clearance_record_id', v_clr);
end $function$;

CREATE OR REPLACE FUNCTION public.issue_certificate(p_enrollment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_clr record; v_cert uuid; v_serial text; v_code text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M6.CREATE') or app.has_perm('M6.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select cr.* into v_clr from public.clearance_records cr
   where cr.enrollment_id = p_enrollment_id for update;
  if not found then raise exception 'NO_CLEARANCE_RECORD' using errcode='P0002'; end if;

  -- BR-01. This check is a readable error; the composite FK below is the guarantee.
  if v_clr.status not in ('APPROVED','APPROVED_BY_OVERRIDE') then
    raise exception 'CLEARANCE_NOT_APPROVED' using errcode='P0001';
  end if;

  if exists (select 1 from public.certificates c where c.enrollment_id = p_enrollment_id) then
    raise exception 'CERTIFICATE_ALREADY_ISSUED' using errcode='P0001';
  end if;

  v_serial := 'HMK-' || to_char(now(),'YYYY') || '-' ||
              upper(encode(extensions.gen_random_bytes(4),'hex'));
  -- BR-10: 128-bit, non-guessable.
  v_code := encode(extensions.gen_random_bytes(16), 'hex');

  -- clearance_status is written from the LOCKED clearance row, never from a parameter.
  -- The composite FK to clearance_records(id, status) makes a forged value impossible.
  insert into public.certificates (enrollment_id, clearance_record_id, clearance_status,
                                   serial_no, verification_code, issued_by,
                                   issued_under_override, status)
  values (p_enrollment_id, v_clr.id, v_clr.status, v_serial, v_code, v_uid,
          v_clr.status = 'APPROVED_BY_OVERRIDE', 'ISSUED')
  returning id into v_cert;

  update public.enrollments set status = 'CERTIFIED', updated_at = now()
   where id = p_enrollment_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, after_state,
                                 is_override, justification)
  values (v_uid, 'ISSUE_CERTIFICATE', 'certificates', v_cert,
          jsonb_build_object('serial_no', v_serial, 'enrollment_id', p_enrollment_id),
          v_clr.status = 'APPROVED_BY_OVERRIDE', v_clr.override_justification);

  return jsonb_build_object('certificate_id', v_cert, 'serial_no', v_serial,
                            'verification_code', v_code,
                            'issued_under_override', v_clr.status = 'APPROVED_BY_OVERRIDE');
end $function$;


revoke all on function public.evaluate_clearance(uuid) from public, anon;
revoke all on function public.approve_clearance(uuid, text) from public, anon;
revoke all on function public.issue_certificate(uuid) from public, anon;
grant execute on function public.evaluate_clearance(uuid)      to authenticated;
grant execute on function public.approve_clearance(uuid, text)  to authenticated;
grant execute on function public.issue_certificate(uuid)        to authenticated;

commit;
