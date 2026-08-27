set search_path = public, extensions, pg_catalog;

-- =====================================================================================
--  Migration 0023 — two gaps the M2 probe exposed at the `participants_can_post` stage.
-- =====================================================================================
--  GAP A — an assigned expert could not SEE their own assignment. consultation_assignments
--  carried only staff/admin policies, so an expert had no queue to work from.
--
--  GAP B — and it made GAP A worse than it looks. A policy expression that subqueries
--  another table is ITSELF subject to that table's RLS. So:
--      consultation_requests.self_consultations
--        ... OR EXISTS (SELECT 1 FROM consultation_assignments ...)
--  was DEAD for the expert: the subquery returned nothing because the expert could not
--  read consultation_assignments. The policy looked like it granted expert access and
--  granted none. My 0022 message policy inherited the same fragility and was caught by
--  the probe: legitimate participants could not post.
--
--  The durable fix is to stop composing participation out of table reads. A SECURITY
--  DEFINER predicate answers "is the CALLER a participant of this request" in one place,
--  immune to the RLS of the tables it consults. It takes no user id — only auth.uid() —
--  so it cannot be asked about anybody else, and it returns a boolean about the caller's
--  own membership and nothing more.
-- =====================================================================================

create or replace function app.is_consultation_participant(p_request_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select exists (
    select 1 from public.consultation_requests cr
     where cr.id = p_request_id
       and (
         cr.requester_user_id = auth.uid()
         or exists (
           select 1 from public.consultation_assignments ca
            where ca.consultation_request_id = cr.id
              and ca.expert_user_id = auth.uid()
              and ca.state in ('PENDING_ACCEPTANCE','ACCEPTED','RELEASED')
         )
       )
  );
$fn$;

comment on function app.is_consultation_participant(uuid) is
  'Answers participation for the CALLER only — it deliberately takes no user id, so it '
  'cannot be used to probe anyone else. SECURITY DEFINER because RLS policies that '
  'subquery other tables are subject to those tables RLS, which silently produced a '
  'policy that granted nothing.';

grant execute on function app.is_consultation_participant(uuid) to authenticated;

-- ---------------------------------------------------------------- GAP A
create policy "self_read_own_assignments" on public.consultation_assignments
  for select to authenticated
  using (expert_user_id = auth.uid());

comment on policy "self_read_own_assignments" on public.consultation_assignments is
  'Without this an expert has no queue, and the expert branch of '
  'consultation_requests.self_consultations evaluates to false for everyone.';

-- ---------------------------------------------------------------- GAP B
drop policy if exists "participants_send_messages" on public.consultation_messages;
create policy "participants_send_messages" on public.consultation_messages
  for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and (app.is_consultation_participant(consultation_request_id) or app.has_perm('M2.UPDATE'))
    and exists (
      -- a closed case does not accept new messages
      select 1 from public.consultation_requests cr
       where cr.id = consultation_messages.consultation_request_id
         and cr.status not in ('RESOLVED','REJECTED')
    )
  );

drop policy if exists "participants_read_messages" on public.consultation_messages;
create policy "participants_read_messages" on public.consultation_messages
  for select to authenticated
  using (app.is_consultation_participant(consultation_request_id) or app.has_perm('M2.READ'));

drop policy if exists "participants_read_attachments" on public.consultation_attachments;
create policy "participants_read_attachments" on public.consultation_attachments
  for select to authenticated
  using (exists (
    select 1 from public.consultation_messages cm
     where cm.id = consultation_attachments.consultation_message_id
       and (app.is_consultation_participant(cm.consultation_request_id) or app.has_perm('M2.READ'))
  ));

-- The status subquery above still reads consultation_requests under the caller's RLS.
-- With the requester and the expert now both able to read the row, that is correct —
-- but it must not be the thing granting access, only the thing denying a closed thread.
-- Participation is decided by the predicate above, which is why both clauses are present.
