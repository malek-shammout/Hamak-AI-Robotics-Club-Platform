-- =====================================================================================
--  HMK Platform — Migration 0017
--  M5 custody: RLS tightening + domain functions
-- =====================================================================================
--  GAP FOUND BY AUDIT, PROVEN BEFORE FIXING:
--    ck_liability_waiver_actor only requires that SOMEONE is named as the waiver:
--      CHECK (status <> 'RESOLVED_WAIVED' OR (waived_by IS NOT NULL AND waiver_justification IS NOT NULL))
--    A CHECK cannot see roles, yet claude.md §4 documents this constraint as enforcing
--    "BR-06, A7-only waiver". Meanwhile staff_update granted UPDATE to anyone holding
--    M5.UPDATE — the Logistics team.
--
--    PROVEN against the live DB: a LOGISTICS member (not A7) set status=RESOLVED_WAIVED,
--    waived_by=<self> on a 250 SYP liability and it persisted. BR-06's A7-only waiver
--    was enforced NOWHERE. This is D-13 for the third time: a row policy restricts which
--    ROWS you may touch, never which COLUMNS or VALUES.
--
--  THE FIX — custody and liability become RPC-WRITE-ONLY:
--    checkouts, checkout_lines and liability_records lose their staff write policies.
--    Every mutation goes through a domain function that asserts the rule. Catalogue
--    tables (asset_types, asset_units, storage_locations, bulk_stock, kit_*) keep
--    ordinary staff CRUD — that is inventory bookkeeping, not custody state.
--
--    DO NOT restore staff_update on liability_records. A liability is a financial and
--    legal record; a hand-edit that skips resolve_liability() skips BR-06 with it.
--
--  VERIFIED by supabase/tests/07_m5_custody_and_liability.sql (rolled back, 0 rows):
--    * student issuing custody to themselves        -> refused 42501
--    * BR-12 student custody with no enrollment     -> ENROLLMENT_REQUIRED
--    * BR-12 team custody, unapproved requisition   -> REQUISITION_NOT_APPROVED
--    * due date in the past                         -> DUE_DATE_IN_PAST
--    * BR-07 same serialized unit issued twice      -> UNIT_ALREADY_CHECKED_OUT
--    * CK_RETURN_INSPECTED check-in with no condition -> CONDITION_REQUIRED
--    * BR-06 DAMAGED return opens a liability valued from asset_types.unit_cost (250),
--      and the unit goes to UNDER_REPAIR rather than back to AVAILABLE
--    * BR-13 new custody while a liability is open  -> HOLDER_HAS_OPEN_LIABILITY
--    * BR-13 override by a non-admin                -> refused 42501
--    * DIRECT UPDATE of liability_records as `authenticated` -> blocked (no write policy)
--    * BR-06 waiver by a LOGISTICS member           -> WAIVER_REQUIRES_ADMIN
--    * legitimate RESOLVED_REPAIRED by Logistics    -> allowed
--    * custody unblocked once the liability resolved
--
--  Two bugs the test caught before the UI existed:
--    a) gen_random_bytes unqualified — pgcrypto lives in the `extensions` schema, and
--       the function correctly pins search_path to (public, pg_temp) per lint 0011,
--       so the call must be schema-qualified.
--    b) `status like 'RESOLVED%'` compared a liability_status enum to text, for which
--       no operator exists; cast to ::text rather than widening the column.
--
--  Applied via MCP as `m5_custody_write_paths_and_domain_functions`, plus the two fixes above.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

drop policy if exists "staff_create" on public.liability_records;
drop policy if exists "staff_update" on public.liability_records;
drop policy if exists "staff_delete" on public.liability_records;
drop policy if exists "staff_create" on public.checkouts;
drop policy if exists "staff_update" on public.checkouts;
drop policy if exists "staff_delete" on public.checkouts;
drop policy if exists "staff_create" on public.checkout_lines;
drop policy if exists "staff_update" on public.checkout_lines;
drop policy if exists "staff_delete" on public.checkout_lines;

comment on table public.liability_records is
  'RPC-WRITE-ONLY. Staff read via staff_read; the holder reads via self_read_liabilities. All mutation goes through resolve_liability() / check_in_line(), which enforce BR-06 - including the A7-only waiver that ck_liability_waiver_actor cannot express.';

commit;

-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====

set search_path = public, extensions, pg_catalog;

begin;

CREATE OR REPLACE FUNCTION public.check_in_line(p_line_id uuid, p_condition_at_return asset_condition, p_inspection_notes text DEFAULT NULL::text, p_evidence_media_id uuid DEFAULT NULL::uuid, p_assessed_value numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_line record; v_co record; v_new checkout_line_status;
  v_liab uuid; v_open int; v_cost numeric; v_currency char(3);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M5.UPDATE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select cl.* into v_line from public.checkout_lines cl where cl.id = p_line_id for update;
  if not found then raise exception 'LINE_NOT_FOUND' using errcode='P0002'; end if;
  if v_line.status not in ('ACTIVE','OVERDUE') then
    raise exception 'LINE_NOT_OUTSTANDING' using errcode='P0001';
  end if;
  if p_condition_at_return is null then
    raise exception 'CONDITION_REQUIRED' using errcode='P0001';   -- CK_RETURN_INSPECTED
  end if;

  select c.* into v_co from public.checkouts c where c.id = v_line.checkout_id for update;

  v_new := case p_condition_at_return
             when 'HEALTHY' then 'RETURNED'::checkout_line_status
             when 'DAMAGED' then 'RETURNED_DAMAGED'::checkout_line_status
             when 'LOST'    then 'LOST'::checkout_line_status
           end;

  update public.checkout_lines
     set status = v_new, returned_at = now(), received_by = v_uid,
         condition_at_return = p_condition_at_return,
         inspection_notes = p_inspection_notes,
         evidence_media_id = p_evidence_media_id
   where id = p_line_id;

  -- Return the serialized unit to stock, or mark it lost/under repair.
  if v_line.asset_unit_id is not null then
    update public.asset_units
       set status = case p_condition_at_return
                      when 'HEALTHY' then 'AVAILABLE'::asset_unit_status
                      when 'DAMAGED' then 'UNDER_REPAIR'::asset_unit_status
                      when 'LOST'    then 'LOST'::asset_unit_status end,
           condition = p_condition_at_return
     where id = v_line.asset_unit_id;
  end if;

  -- BR-06: Damaged or Lost opens a liability that MUST reach a terminal resolution.
  if p_condition_at_return in ('DAMAGED','LOST') then
    select at.unit_cost, at.currency into v_cost, v_currency
      from public.asset_types at where at.id = v_line.asset_type_id;

    insert into public.liability_records (checkout_line_id, holder_user_id, enrollment_id,
                                          liability_type, assessed_value, currency, status)
    values (p_line_id, v_co.holder_user_id, v_co.enrollment_id,
            case when p_condition_at_return='LOST' then 'LOSS'::liability_type
                 else 'DAMAGE'::liability_type end,
            coalesce(p_assessed_value, v_cost, 0), coalesce(v_currency,'SYP'), 'OPEN')
    on conflict (checkout_line_id) do nothing
    returning id into v_liab;
  end if;

  -- Close the parent checkout once nothing is outstanding.
  select count(*) into v_open from public.checkout_lines
   where checkout_id = v_co.id and status in ('ACTIVE','OVERDUE');
  update public.checkouts
     set status = case when v_open = 0 then 'CLOSED'::checkout_status
                       else 'PARTIALLY_RETURNED'::checkout_status end
   where id = v_co.id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, after_state)
  values (v_uid, 'CHECK_IN_LINE', 'checkout_lines', p_line_id,
          jsonb_build_object('condition', p_condition_at_return, 'liability_opened', v_liab is not null));

  return jsonb_build_object('line_id', p_line_id, 'status', v_new,
                            'liability_id', v_liab, 'checkout_closed', v_open = 0);
end $function$;

CREATE OR REPLACE FUNCTION app.holder_has_open_liability(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.liability_records lr
     where lr.holder_user_id = p_user
       and lr.status in ('OPEN','UNDER_ASSESSMENT','PENDING_SETTLEMENT')
  );
$function$;

CREATE OR REPLACE FUNCTION public.issue_checkout(p_custody_type custody_type, p_holder_user_id uuid, p_enrollment_id uuid, p_requisition_id uuid, p_due_at timestamp with time zone, p_lines jsonb, p_override_justification text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_co uuid; v_line jsonb; v_no text;
  v_type record; v_unit record; v_qty int; v_override boolean := false;
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
    end if;
  end loop;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id,
                                 after_state, is_override, justification)
  values (v_uid, 'ISSUE_CHECKOUT', 'checkouts', v_co,
          jsonb_build_object('checkout_no', v_no, 'custody_type', p_custody_type,
                             'holder', p_holder_user_id, 'lines', jsonb_array_length(p_lines)),
          v_override, case when v_override then p_override_justification else null end);

  return v_co;
end $function$;

CREATE OR REPLACE FUNCTION public.resolve_liability(p_liability_id uuid, p_status liability_status, p_note text DEFAULT NULL::text, p_replacement_asset_unit_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_liab record;
  v_terminal boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select lr.* into v_liab from public.liability_records lr
   where lr.id = p_liability_id for update;
  if not found then raise exception 'LIABILITY_NOT_FOUND' using errcode='P0002'; end if;
  if v_liab.status::text like 'RESOLVED%' then
    raise exception 'LIABILITY_ALREADY_TERMINAL' using errcode='P0001';
  end if;

  v_terminal := p_status::text like 'RESOLVED%';

  -- THE FIX. BR-06 makes the waiver an A7 act. ck_liability_waiver_actor can only
  -- require that someone is named; it cannot require that the someone is an admin.
  -- Proven before migration 0017: a LOGISTICS member waived a liability naming
  -- themselves. That assertion lives here now, and no other path reaches the column.
  if p_status = 'RESOLVED_WAIVED' then
    if not app.is_admin() then
      raise exception 'WAIVER_REQUIRES_ADMIN' using errcode='42501';
    end if;
    if p_note is null or btrim(p_note) = '' then
      raise exception 'WAIVER_JUSTIFICATION_REQUIRED' using errcode='P0001';
    end if;
  elsif not (app.has_perm('M5.APPROVE') or app.has_perm('M5.UPDATE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  if p_status = 'RESOLVED_REPLACED' and p_replacement_asset_unit_id is null then
    raise exception 'REPLACEMENT_UNIT_REQUIRED' using errcode='P0001';
  end if;

  update public.liability_records
     set status = p_status,
         resolution_note = p_note,
         replacement_asset_unit_id = p_replacement_asset_unit_id,
         resolved_by = case when v_terminal then v_uid else resolved_by end,
         resolved_at = case when v_terminal then now() else resolved_at end,
         waived_by = case when p_status = 'RESOLVED_WAIVED' then v_uid else waived_by end,
         waiver_justification = case when p_status = 'RESOLVED_WAIVED' then p_note
                                     else waiver_justification end
   where id = p_liability_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id,
                                 before_state, after_state, is_override, justification)
  values (v_uid, 'RESOLVE_LIABILITY', 'liability_records', p_liability_id,
          jsonb_build_object('status', v_liab.status),
          jsonb_build_object('status', p_status),
          p_status = 'RESOLVED_WAIVED',
          case when p_status = 'RESOLVED_WAIVED' then p_note else null end);
end $function$;

revoke all on function public.issue_checkout(custody_type, uuid, uuid, uuid, timestamptz, jsonb, text) from public, anon;
revoke all on function public.check_in_line(uuid, asset_condition, text, uuid, numeric) from public, anon;
revoke all on function public.resolve_liability(uuid, liability_status, text, uuid) from public, anon;
grant execute on function public.issue_checkout(custody_type, uuid, uuid, uuid, timestamptz, jsonb, text) to authenticated;
grant execute on function public.check_in_line(uuid, asset_condition, text, uuid, numeric) to authenticated;
grant execute on function public.resolve_liability(uuid, liability_status, text, uuid) to authenticated;

commit;
