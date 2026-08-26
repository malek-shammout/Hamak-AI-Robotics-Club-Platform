-- =====================================================================================
--  HMK Platform — Migration 0011
--  S1 scheduler: BR-04 offer expiry + waitlist promotion
-- =====================================================================================
--  BR-04 is enforced in TWO places on purpose:
--    1. Lazily inside respond_to_offer — so a missed cron run can never let a stale
--       offer be accepted.
--    2. Here, on a schedule — so an expired offer actually frees its seat and the
--       waitlist moves, even if nobody ever opens the page.
--  Neither alone is sufficient: (1) never promotes anyone, (2) can lag by one interval.
--
--  Verified live: `cron.job` row `hmk-br04-expire-offers` exists and is active.
-- =====================================================================================

create extension if not exists pg_cron with schema extensions;

-- Every 15 minutes. The offer window is measured in hours (default 72), so this is far
-- tighter than the resolution the rule actually needs.
select cron.schedule(
  'hmk-br04-expire-offers',
  '*/15 * * * *',
  $job$ select public.expire_stale_offers(); $job$
);
