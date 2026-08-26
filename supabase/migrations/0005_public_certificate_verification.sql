-- =====================================================================================
--  HMK Platform — Migration 0005
--  Public certificate verification endpoint (BR-10)
-- =====================================================================================
--  BR-10: "Every issued certificate carries a unique, non-guessable verification code
--          resolvable by any third party WITHOUT authentication."
--
--  THE PROBLEM
--    A useful verification result needs the holder's name, the course title and the
--    cohort. Those live in `users`, `enrollments`, `cohorts` and `courses` — none of
--    which have (or should have) an anon read policy. A client-side join therefore
--    returns nothing.
--
--  THE WRONG FIX
--    Adding anon SELECT policies to `enrollments` / `users` so the join works. That
--    would expose the entire roster to the public in exchange for one feature.
--
--  THE FIX TAKEN
--    A single SECURITY DEFINER function with a narrow, fixed projection. Callers get
--    exactly the fields a verifier needs and nothing else; the underlying tables stay
--    closed. The 128-bit code is the capability.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

create or replace function public.verify_certificate(p_code text)
returns table (
  serial_no        varchar,
  issued_at        timestamptz,
  cert_status      certificate_status,
  student_name_ar  varchar,
  student_name_en  varchar,
  course_title_ar  varchar,
  course_title_en  varchar,
  course_level     course_level,
  cohort_code      varchar,
  revoked_at       timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cert_id uuid;
begin
  -- Reject anything that is not a plausible code before touching the table, so this
  -- cannot be used as a cheap oracle with malformed input.
  if p_code is null or length(p_code) not between 16 and 64 then
    return;
  end if;

  select c.id into v_cert_id
    from public.certificates c
   where c.verification_code = p_code;

  if v_cert_id is null then
    return;   -- empty result set: "no such certificate"
  end if;

  -- BR-10 audit trail. No PII retained (see certificate_verifications.source_fingerprint).
  insert into public.certificate_verifications (certificate_id, verified_at)
  values (v_cert_id, now());

  return query
    select c.serial_no,
           c.issued_at,
           c.status,
           u.full_name_ar,
           u.full_name_en,
           co.title_ar,
           co.title_en,
           co.level,
           ch.code,
           c.revoked_at
      from public.certificates c
      join public.enrollments e  on e.id  = c.enrollment_id
      join public.users       u  on u.id  = e.student_user_id
      join public.cohorts     ch on ch.id = e.cohort_id
      join public.courses     co on co.id = ch.course_id
     where c.id = v_cert_id;
end $$;

comment on function public.verify_certificate(text) is
  'BR-10 public certificate verification. SECURITY DEFINER with a fixed narrow projection '
  'so that `users` / `enrollments` / `cohorts` remain closed to anon. Do not widen the '
  'returned columns without a written decision — every added column is a public disclosure.';

-- Deliberately callable without authentication. That is the rule, not an oversight.
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

commit;


-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====
-- Regenerate with: pg_get_functiondef(). These make this file replayable on a
-- fresh project; previously it carried only a rationale header.

CREATE OR REPLACE FUNCTION public.verify_certificate(p_code text)
 RETURNS TABLE(serial_no character varying, issued_at timestamp with time zone, cert_status certificate_status, student_name_ar character varying, student_name_en character varying, course_title_ar character varying, course_title_en character varying, course_level course_level, cohort_code character varying, revoked_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cert_id uuid;
begin
  -- Reject anything that is not a plausible code before touching the table, so this
  -- cannot be used as a cheap oracle with malformed input.
  if p_code is null or length(p_code) not between 16 and 64 then
    return;
  end if;

  select c.id into v_cert_id
    from public.certificates c
   where c.verification_code = p_code;

  if v_cert_id is null then
    return;   -- empty result set: "no such certificate"
  end if;

  -- BR-10 audit trail. No PII retained (see certificate_verifications.source_fingerprint).
  insert into public.certificate_verifications (certificate_id, verified_at)
  values (v_cert_id, now());

  return query
    select c.serial_no,
           c.issued_at,
           c.status,
           u.full_name_ar,
           u.full_name_en,
           co.title_ar,
           co.title_en,
           co.level,
           ch.code,
           c.revoked_at
      from public.certificates c
      join public.enrollments e  on e.id  = c.enrollment_id
      join public.users       u  on u.id  = e.student_user_id
      join public.cohorts     ch on ch.id = e.cohort_id
      join public.courses     co on co.id = ch.course_id
     where c.id = v_cert_id;
end $function$;

