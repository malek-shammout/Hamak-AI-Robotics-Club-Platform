-- =====================================================================================
--  HMK Platform — Migration 0008
--  Pin search_path on every app-schema function
-- =====================================================================================
--  Flagged by the Supabase security advisor (lint 0011_function_search_path_mutable).
--  A function without a pinned search_path can be redirected by whatever the caller
--  has on their path — the classic schema-shadowing escalation. search_path was pinned
--  on the SECURITY DEFINER helpers but missed on the trigger functions, which is
--  exactly the inconsistency the linter exists to catch.
--
--  After this migration the security advisor reports 0 search_path warnings.
-- =====================================================================================

begin;

alter function app.touch_updated_at()            set search_path = public, pg_temp;
alter function app.assert_attempt_limit()        set search_path = public, pg_temp;
alter function app.assert_line_serialization()   set search_path = public, pg_temp;
alter function app.reject_audit_mutation()       set search_path = public, pg_temp;
alter function app.uid()                         set search_path = public, pg_temp;
alter function app.assert_factor_weights_100()   set search_path = public, pg_temp;
alter function app.assert_test_weights_match()   set search_path = public, pg_temp;
alter function app.is_admin()                    set search_path = public, pg_temp;

commit;
