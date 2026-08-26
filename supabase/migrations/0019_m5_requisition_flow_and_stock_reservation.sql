-- =====================================================================================
--  HMK Platform - Migrations 0019 + 0020
--  Requisition flow (BR-12, D-18) and BULK stock reservation (closes RR-1's second half)
-- =====================================================================================
--  D-18 SEPARATION OF DUTIES, ruled by the club 2026-08-26:
--    A4 (Projects / team leads) RAISES a requisition. A3 (Logistics Desk) APPROVES it,
--    because Logistics holds the ultimate truth of physical stock.
--
--    Implemented STRICTLY, on IDENTITY rather than role: approve_requisition and
--    reject_requisition both refuse when the reviewer is the requester - admins
--    included. An ADMIN holds every permission and would otherwise be able to raise
--    and approve their own request, which is exactly the control this prevents.
--
--    Note what raising does NOT require: any M5 permission. A project LEAD with no
--    logistics rights at all may ask; owning the context is the qualification. That
--    asymmetry is the separation.
--
--  RR-1, second half. Seat allocation and serialized custody were already guarded
--  (cohort row locks, uq_checkout_active_unit). BULK stock was not - nothing reserved
--  it, so two approvals could promise the same wire twice. approve_requisition now
--  locks the bulk_stock row FOR UPDATE, re-reads availability INSIDE the lock, and
--  writes a stock_reservations row. Reading availability first and locking second is
--  precisely the race this closes. ck_bulk_stock_nonneg is the backstop; the lock is
--  the mechanism.
--
--  0020 closes the loop: issuing custody against a requisition CONSUMES its
--  reservations, decrementing quantity_on_hand (stock genuinely left) and
--  quantity_reserved (the hold is discharged) in one locked statement. Without it,
--  quantity_reserved would climb forever and the shelf would empty on paper while the
--  items sat on it. release_expired_reservations() returns holds that were never
--  collected, scheduled hourly as `hmk-rr1-release-reservations`.
--
--  VERIFIED by supabase/tests/09_m5_requisition_and_reservation.sql (rolled back):
--    * a non-member raising for someone else's project    -> NOT_CONTEXT_OWNER
--    * a project LEAD with no M5 permission raising        -> allowed, status PENDING
--    * the requester approving their own requisition       -> SEPARATION_OF_DUTIES
--    * an ADMIN approving their OWN requisition            -> SEPARATION_OF_DUTIES
--    * A3 approving                                        -> reserved 8 of 10, on_hand 10
--    * a second approval for the same 10 units             -> INSUFFICIENT_STOCK
--    * a cut-back approval of the 2 that remain            -> PARTIALLY_APPROVED, reserved 10
--    * BR-12 team custody against the approved requisition  -> issued
--    * issuing draws the hold down                         -> on_hand 2, reserved 2, CONSUMED
--    * an expired hold                                      -> released, reserved back to 0
--    * rejection with no reason                            -> REJECTION_REASON_REQUIRED
--
--  Applied via MCP as `m5_requisition_flow_and_stock_reservation` and
--  `consume_reservations_on_issue_and_schedule_release`.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====

CREATE OR REPLACE FUNCTION public.approve_requisition(p_requisition_id uuid, p_line_approvals jsonb DEFAULT NULL::jsonb, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_req record; v_line record; v_appr int; v_entry jsonb;
  v_avail int; v_loc uuid; v_reserved int := 0; v_partial boolean := false;
  v_horizon int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  -- A3 holds the truth of physical stock, so approval is an M5 right.
  if not (app.has_perm('M5.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select r.* into v_req from public.requisitions r where r.id = p_requisition_id for update;
  if not found then raise exception 'REQUISITION_NOT_FOUND' using errcode='P0002'; end if;
  if v_req.status <> 'PENDING' then
    raise exception 'REQUISITION_NOT_PENDING' using errcode='P0001';
  end if;

  -- D-18. Strict: no one approves their own request, admins included. An ADMIN holds
  -- every permission and would otherwise defeat the control entirely.
  if v_req.requester_user_id = v_uid then
    raise exception 'SEPARATION_OF_DUTIES' using errcode='42501';
  end if;

  select coalesce((value #>> '{}')::int, 14) into v_horizon
    from public.system_policies where key = 'custody.default_loan_days';
  v_horizon := coalesce(v_horizon, 14);

  for v_line in
    select rl.*, at.tracking_mode
      from public.requisition_lines rl
      join public.asset_types at on at.id = rl.asset_type_id
     where rl.requisition_id = p_requisition_id
     for update
  loop
    -- Default is approval in full; an explicit entry may cut it back.
    v_appr := v_line.quantity_requested;
    if p_line_approvals is not null then
      select e into v_entry from jsonb_array_elements(p_line_approvals) e
       where (e->>'line_id')::uuid = v_line.id;
      if v_entry is not null then
        v_appr := greatest(0, least(v_line.quantity_requested,
                                    coalesce((v_entry->>'quantity_approved')::int, 0)));
      end if;
    end if;

    if v_appr < v_line.quantity_requested then v_partial := true; end if;

    if v_appr > 0 and v_line.tracking_mode = 'BULK' then
      -- RR-1: lock the stock row, THEN read availability. Reading first and locking
      -- second is precisely the race this closes.
      select bs.storage_location_id, bs.quantity_on_hand - bs.quantity_reserved
        into v_loc, v_avail
        from public.bulk_stock bs
       where bs.asset_type_id = v_line.asset_type_id
       order by (bs.quantity_on_hand - bs.quantity_reserved) desc
       limit 1
       for update;

      if v_loc is null then
        raise exception 'NO_STOCK_RECORD' using errcode='P0002';
      end if;
      if v_avail < v_appr then
        raise exception 'INSUFFICIENT_STOCK' using errcode='P0001',
          detail = format('asset_type %s: available %s, approved %s',
                          v_line.asset_type_id, v_avail, v_appr);
      end if;

      update public.bulk_stock
         set quantity_reserved = quantity_reserved + v_appr, updated_at = now()
       where asset_type_id = v_line.asset_type_id and storage_location_id = v_loc;

      insert into public.stock_reservations (requisition_line_id, asset_type_id,
                                             storage_location_id, quantity, expires_at, status)
      values (v_line.id, v_line.asset_type_id, v_loc, v_appr,
              now() + make_interval(days => v_horizon), 'ACTIVE');

      v_reserved := v_reserved + 1;
    end if;

    update public.requisition_lines set quantity_approved = v_appr where id = v_line.id;
  end loop;

  update public.requisitions
     set status = case when v_partial then 'PARTIALLY_APPROVED'::requisition_status
                       else 'APPROVED'::requisition_status end,
         reviewed_by = v_uid, reviewed_at = now(), review_reason = p_note
   where id = p_requisition_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id,
                                 before_state, after_state)
  values (v_uid, 'APPROVE_REQUISITION', 'requisitions', p_requisition_id,
          jsonb_build_object('status', v_req.status),
          jsonb_build_object('status', case when v_partial then 'PARTIALLY_APPROVED' else 'APPROVED' end,
                             'reservations_created', v_reserved,
                             'requester', v_req.requester_user_id));

  return jsonb_build_object('requisition_id', p_requisition_id,
                            'status', case when v_partial then 'PARTIALLY_APPROVED' else 'APPROVED' end,
                            'reservations_created', v_reserved);
end $function$;

CREATE OR REPLACE FUNCTION public.issue_checkout(p_custody_type custody_type, p_holder_user_id uuid, p_due_at timestamp with time zone, p_lines jsonb, p_enrollment_id uuid DEFAULT NULL::uuid, p_requisition_id uuid DEFAULT NULL::uuid, p_override_justification text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_co uuid; v_line jsonb; v_no text;
  v_type record; v_unit record; v_qty int; v_override boolean := false;
  v_res record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M5.CREATE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'NO_LINES' using errcode='P0001';
  end if;
  if p_due_at is null or p_due_at <= now() then
    raise exception 'DUE_DATE_IN_PAST' using errcode='P0001';
  end if;

  if p_custody_type = 'STUDENT' then
    if p_enrollment_id is null then raise exception 'ENROLLMENT_REQUIRED' using errcode='P0001'; end if;
    if not exists (select 1 from public.enrollments e
                    where e.id = p_enrollment_id and e.student_user_id = p_holder_user_id
                      and e.status in ('ACTIVE','COMPLETED','COMPLETED_BY_OVERRIDE')) then
      raise exception 'NO_ACTIVE_ENROLLMENT' using errcode='P0001';
    end if;
  else
    if p_requisition_id is null then raise exception 'REQUISITION_REQUIRED' using errcode='P0001'; end if;
    if not exists (select 1 from public.requisitions r
                    where r.id = p_requisition_id and r.status in ('APPROVED','PARTIALLY_APPROVED')) then
      raise exception 'REQUISITION_NOT_APPROVED' using errcode='P0001';
    end if;
  end if;

  if app.holder_has_open_liability(p_holder_user_id) then
    if p_override_justification is null or btrim(p_override_justification) = '' then
      raise exception 'HOLDER_HAS_OPEN_LIABILITY' using errcode='P0001';
    end if;
    if not app.is_admin() then
      raise exception 'OVERRIDE_REQUIRES_ADMIN' using errcode='42501';
    end if;
    v_override := true;
  end if;

  v_no := 'CO-' || to_char(now(),'YYYYMMDD') || '-' || upper(encode(extensions.gen_random_bytes(3),'hex'));

  insert into public.checkouts (checkout_no, custody_type, holder_user_id, enrollment_id,
                                requisition_id, issued_by, due_at, status,
                                issued_under_override, override_justification)
  values (v_no, p_custody_type, p_holder_user_id,
          case when p_custody_type='STUDENT' then p_enrollment_id else null end,
          case when p_custody_type='STUDENT' then null else p_requisition_id end,
          v_uid, p_due_at, 'ACTIVE', v_override,
          case when v_override then p_override_justification else null end)
  returning id into v_co;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    select at.id, at.tracking_mode, at.is_consumable into v_type
      from public.asset_types at where at.id = (v_line->>'asset_type_id')::uuid;
    if not found then raise exception 'ASSET_TYPE_NOT_FOUND' using errcode='P0002'; end if;

    v_qty := coalesce((v_line->>'quantity')::int, 1);

    if v_type.tracking_mode = 'SERIALIZED' then
      select au.id, au.status into v_unit
        from public.asset_units au
       where au.id = (v_line->>'asset_unit_id')::uuid for update;
      if not found then raise exception 'ASSET_UNIT_NOT_FOUND' using errcode='P0002'; end if;
      if v_unit.status <> 'AVAILABLE' then
        raise exception 'UNIT_NOT_AVAILABLE' using errcode='P0001';
      end if;
      if exists (select 1 from public.checkout_lines cl
                  where cl.asset_unit_id = v_unit.id and cl.status in ('ACTIVE','OVERDUE')) then
        raise exception 'UNIT_ALREADY_CHECKED_OUT' using errcode='P0001';
      end if;

      insert into public.checkout_lines (checkout_id, asset_type_id, asset_unit_id, quantity,
                                         condition_at_issue, status)
      values (v_co, v_type.id, v_unit.id, 1, 'HEALTHY', 'ACTIVE');

      update public.asset_units set status='CHECKED_OUT' where id = v_unit.id;
    else
      if v_qty <= 0 then raise exception 'INVALID_QUANTITY' using errcode='P0001'; end if;

      insert into public.checkout_lines (checkout_id, asset_type_id, asset_unit_id, quantity,
                                         condition_at_issue, status)
      values (v_co, v_type.id, null, v_qty, 'HEALTHY', 'ACTIVE');

      -- Draw down the reservation this requisition is holding, if any. Locking the
      -- reservation first keeps this consistent with release_expired_reservations().
      if p_requisition_id is not null then
        select sr.* into v_res
          from public.stock_reservations sr
          join public.requisition_lines rl on rl.id = sr.requisition_line_id
         where rl.requisition_id = p_requisition_id
           and sr.asset_type_id = v_type.id
           and sr.status = 'ACTIVE'
         limit 1
         for update of sr;

        if found then
          update public.bulk_stock
             set quantity_on_hand  = greatest(0, quantity_on_hand  - least(v_qty, v_res.quantity)),
                 quantity_reserved = greatest(0, quantity_reserved - v_res.quantity),
                 updated_at = now()
           where asset_type_id = v_res.asset_type_id
             and storage_location_id = v_res.storage_location_id;

          update public.stock_reservations set status = 'CONSUMED' where id = v_res.id;
        end if;
      end if;
    end if;
  end loop;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id,
                                 after_state, is_override, justification)
  values (v_uid, 'ISSUE_CHECKOUT', 'checkouts', v_co,
          jsonb_build_object('checkout_no', v_no, 'custody_type', p_custody_type,
                             'holder', p_holder_user_id, 'lines', jsonb_array_length(p_lines),
                             'requisition_id', p_requisition_id),
          v_override, case when v_override then p_override_justification else null end);

  return v_co;
end $function$;

CREATE OR REPLACE FUNCTION public.raise_requisition(p_purpose_type requisition_purpose_type, p_required_by date, p_lines jsonb, p_cohort_id uuid DEFAULT NULL::uuid, p_project_id uuid DEFAULT NULL::uuid, p_event_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_req uuid; v_no text; v_line jsonb; v_qty int; v_owns boolean := false;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'NO_LINES' using errcode='P0001';
  end if;

  -- The raiser must own the CONTEXT, not hold logistics rights. A project lead may
  -- request hardware for their own project without any M5 permission at all — that is
  -- the point of separating the two duties.
  if p_purpose_type = 'PROJECT' then
    if p_project_id is null then raise exception 'PROJECT_REQUIRED' using errcode='P0001'; end if;
    select exists (
      select 1 from public.project_members pm
       where pm.project_id = p_project_id and pm.user_id = v_uid
    ) or app.has_perm('M7.CREATE') or app.is_admin() into v_owns;
  elsif p_purpose_type = 'EVENT' then
    if p_event_id is null then raise exception 'EVENT_REQUIRED' using errcode='P0001'; end if;
    select exists (
      select 1 from public.events e where e.id = p_event_id and e.created_by = v_uid
    ) or app.has_perm('M8.CREATE') or app.is_admin() into v_owns;
  else
    if p_cohort_id is null then raise exception 'COHORT_REQUIRED' using errcode='P0001'; end if;
    select app.has_perm('M3.CREATE') or app.is_admin() into v_owns;
  end if;

  if not v_owns then
    raise exception 'NOT_CONTEXT_OWNER' using errcode='42501';
  end if;

  v_no := 'RQ-' || to_char(now(),'YYYYMMDD') || '-' || upper(encode(extensions.gen_random_bytes(3),'hex'));

  -- CK_REQ_SINGLE_CONTEXT enforces that exactly one context is set and matches
  -- purpose_type; passing all three would be rejected by the database.
  insert into public.requisitions (requisition_no, requester_user_id, purpose_type,
                                   cohort_id, project_id, event_id, required_by, status)
  values (v_no, v_uid, p_purpose_type,
          case when p_purpose_type='COHORT'  then p_cohort_id  end,
          case when p_purpose_type='PROJECT' then p_project_id end,
          case when p_purpose_type='EVENT'   then p_event_id   end,
          p_required_by, 'PENDING')
  returning id into v_req;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := coalesce((v_line->>'quantity')::int, 0);
    if v_qty <= 0 then raise exception 'INVALID_QUANTITY' using errcode='P0001'; end if;
    if not exists (select 1 from public.asset_types at where at.id = (v_line->>'asset_type_id')::uuid) then
      raise exception 'ASSET_TYPE_NOT_FOUND' using errcode='P0002';
    end if;

    insert into public.requisition_lines (requisition_id, asset_type_id, quantity_requested)
    values (v_req, (v_line->>'asset_type_id')::uuid, v_qty);
  end loop;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, after_state)
  values (v_uid, 'RAISE_REQUISITION', 'requisitions', v_req,
          jsonb_build_object('requisition_no', v_no, 'purpose', p_purpose_type,
                             'lines', jsonb_array_length(p_lines)));

  return v_req;
end $function$;

CREATE OR REPLACE FUNCTION public.reject_requisition(p_requisition_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_req record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M5.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'REJECTION_REASON_REQUIRED' using errcode='P0001';
  end if;

  select r.* into v_req from public.requisitions r where r.id = p_requisition_id for update;
  if not found then raise exception 'REQUISITION_NOT_FOUND' using errcode='P0002'; end if;
  if v_req.status <> 'PENDING' then
    raise exception 'REQUISITION_NOT_PENDING' using errcode='P0001';
  end if;
  if v_req.requester_user_id = v_uid then
    raise exception 'SEPARATION_OF_DUTIES' using errcode='42501';
  end if;

  update public.requisitions
     set status = 'REJECTED', reviewed_by = v_uid, reviewed_at = now(), review_reason = p_reason
   where id = p_requisition_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, after_state)
  values (v_uid, 'REJECT_REQUISITION', 'requisitions', p_requisition_id,
          jsonb_build_object('status','REJECTED','reason',p_reason));
end $function$;

CREATE OR REPLACE FUNCTION public.release_expired_reservations()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r record; v_n int := 0;
begin
  for r in
    select sr.* from public.stock_reservations sr
     where sr.status = 'ACTIVE' and sr.expires_at < now()
     for update
  loop
    update public.bulk_stock
       set quantity_reserved = greatest(0, quantity_reserved - r.quantity), updated_at = now()
     where asset_type_id = r.asset_type_id and storage_location_id = r.storage_location_id;

    update public.stock_reservations set status = 'EXPIRED' where id = r.id;
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('released', v_n, 'ran_at', now());
end $function$;


revoke all on function public.raise_requisition(requisition_purpose_type, date, jsonb, uuid, uuid, uuid) from public, anon;
revoke all on function public.approve_requisition(uuid, jsonb, text) from public, anon;
revoke all on function public.reject_requisition(uuid, text) from public, anon;
revoke all on function public.release_expired_reservations() from public, anon, authenticated;
grant execute on function public.raise_requisition(requisition_purpose_type, date, jsonb, uuid, uuid, uuid) to authenticated;
grant execute on function public.approve_requisition(uuid, jsonb, text) to authenticated;
grant execute on function public.reject_requisition(uuid, text) to authenticated;
grant execute on function public.release_expired_reservations() to service_role;

commit;

-- S1: return stock reserved but never collected. Hourly is ample - the horizon is days.
-- select cron.schedule('hmk-rr1-release-reservations', '7 * * * *',
--                      $job$ select public.release_expired_reservations(); $job$);
