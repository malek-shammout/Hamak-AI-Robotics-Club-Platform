-- =====================================================================================
--  M5 — requisition flow (BR-12, D-18) and BULK stock reservation (RR-1)
-- =====================================================================================
--  D-18 SEPARATION OF DUTIES: A4 raises, A3 approves, and NOBODY approves their own
--  request — admins included. An ADMIN holds every permission and would otherwise
--  defeat the control entirely, so the assertion is on identity, not on role.
--
--  RR-1: BULK stock had no reservation, so two approvals could promise the same wire
--  twice. approve_requisition locks bulk_stock, re-reads availability inside the lock,
--  and writes a stock_reservations row. This test proves the second approval is refused.
-- =====================================================================================
do $test$
declare
  v_admin uuid; v_a4 uuid := gen_random_uuid(); v_a3 uuid := gen_random_uuid();
  v_deptP uuid; v_roleP uuid; v_deptL uuid; v_roleL uuid; v_loc uuid;
  v_cat uuid; v_bulk uuid; v_serial uuid; v_unit uuid;
  v_project uuid; v_req uuid; v_req2 uuid; v_reqSelf uuid;
  v_line uuid; v_res jsonb; v_co uuid;
  v_onhand int; v_reserved int; v_err text; v_stage text := 'setup';
begin
  select id into v_admin from public.users
   where id in (select ur.user_id from public.user_roles ur
                  join public.roles r on r.id = ur.role_id
                 where r.code = 'ADMIN' and ur.revoked_at is null) limit 1;
  if v_admin is null then raise exception 'PRECONDITION: no ADMIN user exists'; end if;

  select id into v_deptP from public.departments where code = 'PROJECTS';
  select id into v_roleP from public.roles       where code = 'PROJECTS';
  select id into v_deptL from public.departments where code = 'LOGISTICS';
  select id into v_roleL from public.roles       where code = 'LOGISTICS';

  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values (v_a4,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t09a4@probe.invalid',null,now(),now(),now()),
         (v_a3,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t09a3@probe.invalid',null,now(),now(),now());
  update public.users set user_type='MEMBER', status='ACTIVE' where id in (v_a4, v_a3);
  insert into public.user_roles (user_id, role_id, department_id)
  values (v_a4, v_roleP, v_deptP), (v_a3, v_roleL, v_deptL);

  insert into public.asset_categories (code,name_ar,name_en) values ('T09-CAT','ف','Cat') returning id into v_cat;
  insert into public.storage_locations (code,name) values ('T09-LOC','Probe shelf') returning id into v_loc;
  insert into public.asset_types (asset_category_id,name,manufacturer,model,tracking_mode,unit_cost,currency)
  values (v_cat,'Wire','Acme','T09-BULK','BULK',5,'SYP') returning id into v_bulk;
  insert into public.asset_types (asset_category_id,name,manufacturer,model,tracking_mode,unit_cost,currency)
  values (v_cat,'Kit','Acme','T09-SER','SERIALIZED',400,'SYP') returning id into v_serial;
  insert into public.asset_units (asset_type_id,asset_tag) values (v_serial,'T09-TAG-1') returning id into v_unit;

  -- exactly 10 on hand: enough for one request of 8, not for two
  insert into public.bulk_stock (asset_type_id, storage_location_id, quantity_on_hand, quantity_reserved)
  values (v_bulk, v_loc, 10, 0);

  insert into public.projects (code,title_ar,title_en,status,publication_status,created_by)
  values ('T09-PRJ','مشروع','Probe Project','IN_PROGRESS','DRAFT',v_a4) returning id into v_project;
  insert into public.project_members (project_id,user_id,role_in_project) values (v_project, v_a4, 'LEAD');

  ------------------------------------------------------------------ raising
  v_stage := 'outsider_cannot_raise';
  perform set_config('request.jwt.claims', json_build_object('sub', v_a3::text)::text, true);
  begin
    perform public.raise_requisition('PROJECT', current_date + 7,
      jsonb_build_array(jsonb_build_object('asset_type_id', v_bulk, 'quantity', 8)),
      null, v_project, null);
    raise exception 'BREACH: a non-member raised a requisition for someone else''s project';
  exception when insufficient_privilege then null;
  end;

  -- A4 is a project LEAD and holds no M5 permission at all. That is the point of
  -- separating the duties: owning the context is enough to ask.
  v_stage := 'a4_raises';
  perform set_config('request.jwt.claims', json_build_object('sub', v_a4::text)::text, true);
  v_req := public.raise_requisition('PROJECT', current_date + 7,
    jsonb_build_array(jsonb_build_object('asset_type_id', v_bulk, 'quantity', 8)),
    null, v_project, null);
  if (select status from public.requisitions where id = v_req) <> 'PENDING' then
    raise exception 'BREACH: a raised requisition did not start PENDING';
  end if;

  v_stage := 'a4_cannot_approve_own';
  begin
    perform public.approve_requisition(v_req);
    raise exception 'BREACH: the requester approved their own requisition (D-18)';
  exception when insufficient_privilege then null;
  end;

  ------------------------------------------------------------------ D-18 for ADMIN too
  v_stage := 'admin_cannot_approve_own';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  insert into public.project_members (project_id,user_id,role_in_project)
  values (v_project, v_admin, 'DOCUMENTATION');
  v_reqSelf := public.raise_requisition('PROJECT', current_date + 7,
    jsonb_build_array(jsonb_build_object('asset_type_id', v_bulk, 'quantity', 1)),
    null, v_project, null);
  begin
    perform public.approve_requisition(v_reqSelf);
    raise exception 'BREACH: an ADMIN approved their OWN requisition. D-18 is on identity, not role.';
  exception when insufficient_privilege then null;
  end;

  ------------------------------------------------------------------ RR-1 reservation
  v_stage := 'a3_approves_and_reserves';
  perform set_config('request.jwt.claims', json_build_object('sub', v_a3::text)::text, true);
  v_res := public.approve_requisition(v_req, null, 'Stock confirmed on the shelf.');
  if v_res->>'status' <> 'APPROVED' then
    raise exception 'BREACH: expected APPROVED, got %', v_res->>'status';
  end if;
  if (v_res->>'reservations_created')::int <> 1 then
    raise exception 'BREACH: no stock reservation was created for the BULK line (RR-1)';
  end if;

  select quantity_on_hand, quantity_reserved into v_onhand, v_reserved
    from public.bulk_stock where asset_type_id = v_bulk and storage_location_id = v_loc;
  if v_onhand <> 10 or v_reserved <> 8 then
    raise exception 'BREACH: expected on_hand 10 / reserved 8, got % / %', v_onhand, v_reserved;
  end if;

  ------------------------------------------------------------------ the RR-1 race
  v_stage := 'second_approval_refused';
  perform set_config('request.jwt.claims', json_build_object('sub', v_a4::text)::text, true);
  v_req2 := public.raise_requisition('PROJECT', current_date + 7,
    jsonb_build_array(jsonb_build_object('asset_type_id', v_bulk, 'quantity', 8)),
    null, v_project, null);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a3::text)::text, true);
  begin
    perform public.approve_requisition(v_req2);
    raise exception 'BREACH: the same 10 units were promised twice (RR-1)';
  exception when others then
    if sqlerrm not like '%INSUFFICIENT_STOCK%' then raise; end if;
  end;

  -- Only 2 free, so a cut-back approval of 2 must succeed.
  v_stage := 'partial_approval_within_stock';
  select rl.id into v_line from public.requisition_lines rl where rl.requisition_id = v_req2;
  v_res := public.approve_requisition(v_req2,
    jsonb_build_array(jsonb_build_object('line_id', v_line, 'quantity_approved', 2)),
    'Only 2 free after the earlier hold.');
  if v_res->>'status' <> 'PARTIALLY_APPROVED' then
    raise exception 'BREACH: a cut-back approval was not marked PARTIALLY_APPROVED';
  end if;
  select quantity_reserved into v_reserved
    from public.bulk_stock where asset_type_id = v_bulk and storage_location_id = v_loc;
  if v_reserved <> 10 then
    raise exception 'BREACH: expected reserved 10 after the second hold, got %', v_reserved;
  end if;

  ------------------------------------------------------------------ BR-12 team custody
  v_stage := 'team_custody_unlocked';
  v_co := public.issue_checkout(
    p_custody_type => 'PROJECT_TEAM', p_holder_user_id => v_a4,
    p_due_at => now() + interval '7 days',
    p_lines => jsonb_build_array(
      jsonb_build_object('asset_type_id', v_bulk, 'quantity', 8),
      jsonb_build_object('asset_type_id', v_serial, 'asset_unit_id', v_unit)),
    p_requisition_id => v_req);
  if v_co is null then raise exception 'BREACH: team custody could not be issued'; end if;

  -- Issuing must DRAW DOWN the hold, not leave it standing.
  select quantity_on_hand, quantity_reserved into v_onhand, v_reserved
    from public.bulk_stock where asset_type_id = v_bulk and storage_location_id = v_loc;
  if v_onhand <> 2 then
    raise exception 'BREACH: on_hand should have fallen to 2, got %', v_onhand;
  end if;
  if v_reserved <> 2 then
    raise exception 'BREACH: the consumed hold was not discharged (reserved=%)', v_reserved;
  end if;
  if (select status from public.stock_reservations sr
       join public.requisition_lines rl on rl.id = sr.requisition_line_id
      where rl.requisition_id = v_req) <> 'CONSUMED' then
    raise exception 'BREACH: the reservation was not marked CONSUMED';
  end if;

  ------------------------------------------------------------------ S1 release
  v_stage := 'expired_hold_released';
  update public.stock_reservations set expires_at = now() - interval '1 hour'
   where status = 'ACTIVE';
  v_res := public.release_expired_reservations();
  if (v_res->>'released')::int < 1 then
    raise exception 'BREACH: an expired reservation was not released';
  end if;
  select quantity_reserved into v_reserved
    from public.bulk_stock where asset_type_id = v_bulk and storage_location_id = v_loc;
  if v_reserved <> 0 then
    raise exception 'BREACH: expired stock was not returned to the shelf (reserved=%)', v_reserved;
  end if;

  ------------------------------------------------------------------ rejection
  v_stage := 'rejection_requires_reason';
  perform set_config('request.jwt.claims', json_build_object('sub', v_a4::text)::text, true);
  v_req2 := public.raise_requisition('PROJECT', current_date + 7,
    jsonb_build_array(jsonb_build_object('asset_type_id', v_bulk, 'quantity', 1)),
    null, v_project, null);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a3::text)::text, true);
  begin
    perform public.reject_requisition(v_req2, '');
    raise exception 'BREACH: a requisition was rejected with no reason';
  exception when others then
    if sqlerrm not like '%REJECTION_REASON_REQUIRED%' then raise; end if;
  end;
  perform public.reject_requisition(v_req2, 'Out of scope for this project.');
  if (select status from public.requisitions where id = v_req2) <> 'REJECTED' then
    raise exception 'BREACH: the requisition was not rejected';
  end if;

  raise exception 'ALL_M5_REQUISITION_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_M5_REQUISITION_PASSED' then raise exception 'ALL_M5_REQUISITION_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
