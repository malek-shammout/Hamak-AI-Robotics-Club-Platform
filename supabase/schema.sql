-- =====================================================================================
--  HMK Platform — Database Schema
--  نادي الهمك للذكاء الصنعي والروبوتيك / HMK AI & Robotics Club
-- =====================================================================================
--  Document ID : HMK-DB-P2-SCHEMA-v1
--  Derived from: HMK-SA-P1-S1  (Use Cases & User Stories)
--                HMK_Platform_Phase1_Step2_Step3_Workflows_ERD.md (Parts A/B/C/D)
--  Entities    : 78 (matches §C.14 Entity Inventory exactly)
--  Constraints : 19 named constraints (§C.11) + FK/UNIQUE/CHECK
--  Views       : 6 derived views (§C.12) — deliberately not stored as columns
--  Target      : PostgreSQL 15+ / Supabase
--
--  RATIFIED DECISIONS EMBEDDED IN THIS SCHEMA
--    D-01  multi-role / multi-department  -> user_roles is a table w/ department_id + expires_at
--    D-02  single identity store          -> users + student_profiles + member_profiles (1:0..1)
--    D-03  clearance PER ENROLLMENT       -> clearance_records.enrollment_id UNIQUE (1:1)
--    D-04  two-tier soft gate (BR-13)     -> liability blocks checkouts; advisory on clearance
--    D-05  one accountable holder         -> checkouts.custody_type + CK_CHECKOUT_CONTEXT
--    D-06  curated expertise              -> member_expertise.curated_by + is_available
--    D-07  optional screening             -> courses.requires_screening
--    D-08  explicit publish transition    -> publication_status on all public entities
--    RR-3  consumables EXCLUDED from return obligation  [CONFIRMED BY CLUB 2026-08-25]
--
--  NEW DECISIONS TAKEN AT IMPLEMENTATION TIME (recorded in claude.md)
--    D-09  RR-2 resolved DECLARATIVELY, not by trigger. certificates carries a mirrored
--          clearance_status column bound by a COMPOSITE FK to clearance_records(id,status).
--          A certificate therefore cannot reference a non-approved clearance, and an
--          approved clearance cannot be moved out of the approved state while a
--          certificate references it. BR-01 holds at the storage layer.
--    D-10  Supabase Auth owns credentials. public.users.password_hash is REMOVED and
--          public.users.id is a FK to auth.users(id). token_epoch is retained for
--          JWT-claim invalidation.
-- =====================================================================================

begin;

-- =====================================================================================
--  SECTION 0 — EXTENSIONS, SCHEMAS, DOMAINS
-- =====================================================================================

-- Supabase installs extensions into the `extensions` schema. The GiST operator classes that
-- EX_SESSION_ROOM_OVERLAP depends on are only resolvable if that schema is on the search_path
-- at DDL time, so it is set explicitly rather than assumed.
set search_path = public, extensions, pg_catalog;

create extension if not exists "pgcrypto"    with schema extensions;  -- gen_random_uuid, gen_random_bytes
create extension if not exists "citext"      with schema extensions;  -- case-insensitive email
create extension if not exists "btree_gist"  with schema extensions;  -- EX_SESSION_ROOM_OVERLAP

-- Helper namespace. Kept out of `public` so it is never exposed through PostgREST.
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, anon, service_role;

-- §C.1 Modelling Conventions — Multilingual / Money / Time
create domain public.locale_code   as char(2) check (value in ('ar', 'en'));
create domain public.currency_code as char(3) check (value ~ '^[A-Z]{3}$');

-- =====================================================================================
--  SECTION 1 — ENUM TYPES
--  §C.1: reference lists the club EDITS AT RUNTIME are tables, not enums.
--  Everything below is a closed vocabulary owned by the domain model.
-- =====================================================================================

-- Cross-cutting (D-08 / BR-11)
create type publication_status as enum ('DRAFT','PENDING_REVIEW','SCHEDULED','PUBLISHED','REJECTED');

-- M10 — Identity, RBAC, Audit, Notifications
create type user_type            as enum ('EXTERNAL_STUDENT','MEMBER');
create type user_status          as enum ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','DEACTIVATED');
create type membership_status    as enum ('ACTIVE','ON_LEAVE','ALUMNI');
create type permission_action    as enum ('CREATE','READ','UPDATE','DELETE','APPROVE','OVERRIDE','EXPORT');
create type notification_channel as enum ('EMAIL','IN_APP');
create type notification_status  as enum ('QUEUED','SENT','FAILED');

-- M3 — Courses, Cohorts, Applications, Enrollment
create type course_level          as enum ('BEGINNER','INTERMEDIATE','ADVANCED');
create type course_status         as enum ('DRAFT','PUBLISHED','ARCHIVED');
create type module_visibility     as enum ('PUBLIC','ENROLLED','INTERNAL');
create type material_visibility   as enum ('ENROLLED','INTERNAL');
create type cohort_status         as enum ('DRAFT','OPEN','CLOSED','RUNNING','FINISHED','CANCELLED');
create type cohort_session_status as enum ('PLANNED','HELD','CANCELLED');
create type application_status    as enum ('SUBMITTED','AWAITING_SCREENING','UNDER_EVALUATION','OFFERED',
                                           'WAITLISTED','ENROLLED','REJECTED','DECLINED','EXPIRED','WITHDRAWN');
create type enrollment_status     as enum ('ACTIVE','COMPLETED','COMPLETED_BY_OVERRIDE','NOT_COMPLETED',
                                           'WITHDRAWN','CERTIFIED','CERTIFICATE_REVOKED');
create type attendance_state      as enum ('PRESENT','ABSENT','EXCUSED','LATE');

-- M4 — Screening, Assessment, Scoring
create type question_type          as enum ('SINGLE_CHOICE','MULTI_CHOICE','TRUE_FALSE','NUMERIC','SHORT_ANSWER','CODE');
create type question_difficulty    as enum ('EASY','MEDIUM','HARD');
create type test_result_visibility as enum ('HIDDEN','SCORE_ONLY','SCORE_AND_FEEDBACK','FULL');
create type screening_test_status  as enum ('DRAFT','ACTIVE','LOCKED','ARCHIVED');
create type test_attempt_state     as enum ('IN_PROGRESS','SUBMITTED','GRADING','GRADED','VOIDED');
create type readiness_value_source as enum ('TEST','DECLARED','MANUAL');

-- M5 — Hardware Inventory, Requisition, Custody
create type asset_unit_of_measure     as enum ('PIECE','METER','GRAM','SET');
create type asset_tracking_mode       as enum ('SERIALIZED','BULK');
create type asset_condition           as enum ('HEALTHY','DAMAGED','LOST');
create type asset_unit_status         as enum ('AVAILABLE','RESERVED','CHECKED_OUT','UNDER_REPAIR','LOST','RETIRED','WRITTEN_OFF');
create type requisition_purpose_type  as enum ('COHORT','PROJECT','EVENT');
create type requisition_status        as enum ('PENDING','APPROVED','PARTIALLY_APPROVED','REJECTED','FULFILLED','CANCELLED');
create type stock_reservation_status  as enum ('ACTIVE','CONSUMED','EXPIRED','RELEASED');
create type custody_type              as enum ('STUDENT','PROJECT_TEAM','EVENT_LEAD');
create type checkout_status           as enum ('ACTIVE','PARTIALLY_RETURNED','CLOSED');
create type checkout_line_condition   as enum ('HEALTHY','DAMAGED');
create type checkout_line_status      as enum ('ACTIVE','OVERDUE','RETURNED','RETURNED_DAMAGED','LOST');
create type asset_incident_status     as enum ('OPEN','ACKNOWLEDGED','RESOLVED','DISMISSED');
create type liability_type            as enum ('DAMAGE','LOSS');
create type liability_status          as enum ('OPEN','UNDER_ASSESSMENT','PENDING_SETTLEMENT','RESOLVED_REPAIRED',
                                               'RESOLVED_REPLACED','RESOLVED_SETTLED','RESOLVED_WAIVED');

-- M6 — Clearance & Certification
create type clearance_status       as enum ('EVALUATING','WITHHELD','APPROVED','APPROVED_BY_OVERRIDE','REVOKED');
create type clearance_blocker_code as enum ('NOT_COMPLETED','ITEMS_OUTSTANDING','INSPECTION_PENDING','LIABILITY_OPEN','INCIDENT_OPEN');
create type certificate_status     as enum ('ISSUED','REVOKED','REISSUED');

-- M2 — Consultation Gateway
create type expertise_proficiency        as enum ('FAMILIAR','PROFICIENT','EXPERT');
create type consultation_support_type    as enum ('TECHNICAL_ADVICE','COMPONENT_SELECTION','CODE_REVIEW','MENTORSHIP','OTHER');
create type consultation_status          as enum ('NEW','TRIAGED','ASSIGNED','IN_PROGRESS','RESOLVED','REJECTED','ESCALATED');
create type consultation_priority        as enum ('LOW','NORMAL','HIGH');
create type consultation_complexity      as enum ('LOW','MEDIUM','HIGH');
create type consultation_outcome         as enum ('ADVICE_GIVEN','ONGOING_MENTORSHIP','OUT_OF_SCOPE','UNRESPONSIVE');
create type consultation_assignment_state as enum ('PENDING_ACCEPTANCE','ACCEPTED','DECLINED','NO_RESPONSE','RELEASED');

-- M7 — Projects
create type project_status           as enum ('IDEA','IN_PROGRESS','COMPLETED','ARCHIVED');
create type project_member_role      as enum ('LEAD','HARDWARE','FIRMWARE','MECHANICAL','ML','DOCUMENTATION');
create type project_media_visibility as enum ('PUBLIC','INTERNAL');

-- M8 — Events
create type event_type               as enum ('WORKSHOP','EXHIBITION','HACKATHON','SEMINAR');
create type event_eligibility        as enum ('PUBLIC','REGISTERED_STUDENTS','MEMBERS_ONLY');
create type event_status             as enum ('PLANNED','RUNNING','FINISHED','CANCELLED','POSTPONED');
create type event_registration_state as enum ('REGISTERED','WAITLISTED','CANCELLED','ATTENDED','NO_SHOW');

-- M9 — Media, News, Hall of Fame
create type media_usage_rights as enum ('CLUB_OWNED','LICENSED','PUBLIC_DOMAIN','RESTRICTED');
create type award_level        as enum ('LOCAL','NATIONAL','INTERNATIONAL');

-- =====================================================================================
--  SECTION 2 — MODULE M10: IDENTITY, RBAC, AUDIT & NOTIFICATIONS   (13 tables)
-- =====================================================================================

-- D-02: ONE identity store, discriminated by user_type, extended by profile tables.
-- D-10: Supabase Auth owns credentials; no password_hash here.
create table public.users (
  id                uuid primary key references auth.users(id) on delete restrict,
  email             extensions.citext not null unique,
  phone             varchar(32),
  full_name_ar      varchar(160) not null,
  full_name_en      varchar(160) not null,
  user_type         user_type   not null,
  status            user_status not null default 'PENDING_VERIFICATION',
  locale            public.locale_code not null default 'ar',
  email_verified_at timestamptz,
  last_login_at     timestamptz,
  token_epoch       integer     not null default 0,   -- bump to invalidate live sessions
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.users is 'D-02 single identity store. Extended 1:0..1 by student_profiles / member_profiles.';

create table public.universities (
  id           uuid primary key default gen_random_uuid(),
  name_ar      varchar(200) not null unique,
  name_en      varchar(200) not null,
  country_code char(2)      not null default 'SY',
  created_at   timestamptz  not null default now()
);

create table public.departments (
  id           uuid primary key default gen_random_uuid(),
  code         varchar(40)  not null unique,   -- TRAINING LOGISTICS PROJECTS EVENTS MEDIA ADMIN
  name_ar      varchar(120) not null,
  name_en      varchar(120) not null,
  mandate      text,
  lead_user_id uuid references public.users(id) on delete set null,
  created_at   timestamptz  not null default now()
);

create table public.student_profiles (
  user_id         uuid primary key references public.users(id) on delete cascade,
  university_id   uuid references public.universities(id) on delete restrict,
  faculty         varchar(160),
  department_name varchar(160),
  academic_year   smallint check (academic_year between 1 and 7),
  student_number  varchar(60),
  updated_at      timestamptz not null default now(),
  constraint uq_student_number_per_university unique (university_id, student_number)
);

create table public.member_profiles (
  user_id               uuid primary key references public.users(id) on delete cascade,
  primary_department_id uuid references public.departments(id) on delete restrict,
  joined_on             date,
  bio_ar                text,
  bio_en                text,
  membership_status     membership_status not null default 'ACTIVE',
  updated_at            timestamptz not null default now()
);

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        varchar(40)  not null unique,
  name_ar     varchar(120) not null,
  name_en     varchar(120) not null,
  description text,
  is_system   boolean     not null default false,   -- system roles cannot be deleted
  created_at  timestamptz not null default now()
);

create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  code        varchar(80) not null unique,          -- '<module>.<action>' e.g. 'M5.APPROVE'
  module      varchar(8)  not null check (module ~ '^M(10|[1-9])$'),
  action      permission_action not null,
  description text,
  constraint uq_permission_module_action unique (module, action)
);

create table public.role_permissions (
  role_id       uuid not null references public.roles(id)       on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  granted_at    timestamptz not null default now(),
  granted_by    uuid references public.users(id) on delete set null,
  primary key (role_id, permission_id)
);

-- D-01: role assignment is a RELATIONSHIP (multi-role, multi-department, expirable).
create table public.user_roles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  role_id       uuid not null references public.roles(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  assigned_by   uuid references public.users(id) on delete set null,
  assigned_at   timestamptz not null default now(),
  expires_at    timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid references public.users(id) on delete set null,
  constraint ck_role_expiry check (expires_at is null or expires_at > assigned_at)  -- CK_ROLE_EXPIRY
);
create index ix_user_roles_live on public.user_roles (user_id)
  where revoked_at is null;

-- BR-09: append-only. UPDATE/DELETE are revoked in SECTION 12.
create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,  -- null = system actor (S1..S4)
  action        varchar(120) not null,
  entity_type   varchar(80)  not null,
  entity_id     uuid,
  before_state  jsonb,
  after_state   jsonb,
  is_override   boolean not null default false,
  justification text,
  ip_address    inet,
  user_agent    varchar(400),
  created_at    timestamptz not null default now(),
  constraint ck_audit_override_justified check (is_override = false or justification is not null)
);
create index ix_audit_entity on public.audit_logs (entity_type, entity_id, created_at desc);
create index ix_audit_actor  on public.audit_logs (actor_user_id, created_at desc);

create table public.system_policies (
  id          uuid primary key default gen_random_uuid(),
  key         varchar(120) not null unique,
  value       jsonb        not null,
  description text,
  updated_by  uuid references public.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table public.notification_templates (
  id                 uuid primary key default gen_random_uuid(),
  code               varchar(80) not null,
  locale             public.locale_code not null,
  channel            notification_channel not null,
  subject            varchar(240),
  body               text not null,
  declared_variables jsonb not null default '[]'::jsonb,
  updated_at         timestamptz not null default now(),
  constraint uq_template_code_locale unique (code, locale)
);

create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  template_id       uuid references public.notification_templates(id) on delete set null,
  payload           jsonb not null default '{}'::jsonb,
  channel           notification_channel not null,
  status            notification_status  not null default 'QUEUED',
  sent_at           timestamptz,
  read_at           timestamptz,
  created_at        timestamptz not null default now()
);
create index ix_notifications_inbox on public.notifications (recipient_user_id, created_at desc);

-- =====================================================================================
--  SECTION 3 — MEDIA ASSETS  (part of M9, created early: referenced by M3/M5/M6/M2/M7)
-- =====================================================================================

create table public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  storage_key  varchar(400) not null unique,   -- Supabase Storage object path
  mime_type    varchar(120) not null,
  byte_size    bigint       not null check (byte_size >= 0),
  width        integer,
  height       integer,
  caption      varchar(300),
  credit       varchar(200),
  captured_on  date,
  usage_rights media_usage_rights not null default 'CLUB_OWNED',
  uploaded_by  uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- =====================================================================================
--  SECTION 4 — MODULE M5a: ASSET CATALOGUE & KITS  (created before M3: courses -> kits)
-- =====================================================================================

create table public.asset_categories (
  id      uuid primary key default gen_random_uuid(),
  code    varchar(40)  not null unique,   -- MICROCONTROLLER SENSOR ACTUATOR TOOL PRINTER_3D CONSUMABLE OTHER
  name_ar varchar(120) not null,
  name_en varchar(120) not null
);

create table public.asset_types (
  id                  uuid primary key default gen_random_uuid(),
  asset_category_id   uuid not null references public.asset_categories(id) on delete restrict,
  name                varchar(200) not null,
  manufacturer        varchar(160),
  model               varchar(160),
  specifications      jsonb not null default '{}'::jsonb,
  datasheet_url       varchar(500),
  unit_of_measure     asset_unit_of_measure not null default 'PIECE',
  tracking_mode       asset_tracking_mode   not null,
  is_consumable       boolean not null default false,  -- RR-3 CONFIRMED: excluded from BR-01 return obligation
  low_stock_threshold smallint not null default 0 check (low_stock_threshold >= 0),
  unit_cost           numeric(12,2) check (unit_cost >= 0),
  currency            public.currency_code not null default 'SYP',
  created_at          timestamptz not null default now(),
  constraint uq_asset_type_manufacturer_model unique (manufacturer, model)
);
comment on column public.asset_types.is_consumable is
  'RR-3 (confirmed 2026-08-25): consumables are excluded from the BR-01 return obligation. '
  'v_enrollment_outstanding_items and the clearance evaluator both filter on is_consumable = false.';

create table public.storage_locations (
  id                 uuid primary key default gen_random_uuid(),
  code               varchar(40)  not null unique,
  name               varchar(160) not null,
  parent_location_id uuid references public.storage_locations(id) on delete restrict,
  description        text
);

create table public.asset_units (
  id                  uuid primary key default gen_random_uuid(),
  asset_type_id       uuid not null references public.asset_types(id) on delete restrict,
  asset_tag           varchar(60) not null unique,
  acquisition_date    date,
  acquisition_source  varchar(200),
  cost_center         varchar(120),
  current_location_id uuid references public.storage_locations(id) on delete set null,
  condition           asset_condition   not null default 'HEALTHY',
  status              asset_unit_status not null default 'AVAILABLE',
  retired_at          timestamptz,
  retire_reason       text,
  created_at          timestamptz not null default now()
);
create index ix_asset_units_type_status on public.asset_units (asset_type_id, status);

create table public.bulk_stock (
  id                  uuid primary key default gen_random_uuid(),
  asset_type_id       uuid not null references public.asset_types(id)       on delete restrict,
  storage_location_id uuid not null references public.storage_locations(id) on delete restrict,
  quantity_on_hand    integer not null default 0,
  quantity_reserved   integer not null default 0,
  updated_at          timestamptz not null default now(),
  constraint uq_bulk_stock_type_location unique (asset_type_id, storage_location_id),
  constraint ck_bulk_stock_nonneg check (                                   -- CK_BULK_STOCK_NONNEG
    quantity_on_hand  >= 0
    and quantity_reserved >= 0
    and quantity_reserved <= quantity_on_hand
  )
);

create table public.kit_templates (
  id          uuid primary key default gen_random_uuid(),
  code        varchar(40)  not null unique,
  name        varchar(200) not null,
  description text,
  created_at  timestamptz not null default now()
);

create table public.kit_template_items (
  kit_template_id uuid not null references public.kit_templates(id) on delete cascade,
  asset_type_id   uuid not null references public.asset_types(id)   on delete restrict,
  quantity        integer not null check (quantity > 0),
  primary key (kit_template_id, asset_type_id)
);

-- =====================================================================================
--  SECTION 5 — MODULE M3: COURSES, COHORTS, APPLICATIONS & ENROLLMENT  (10 tables)
-- =====================================================================================

create table public.courses (
  id                uuid primary key default gen_random_uuid(),
  code              varchar(40) not null unique,
  title_ar          varchar(240) not null,
  title_en          varchar(240) not null,
  track             varchar(40) not null
                    check (track in ('ARDUINO','PCB','PRINTING_3D','AI','VIBE_CODING','OTHER')),
  level             course_level not null,
  description_ar    text,
  description_en    text,
  learning_outcomes text,
  prerequisites_text text,
  session_count     smallint check (session_count > 0),
  duration_hours    smallint check (duration_hours > 0),
  language          public.locale_code not null default 'ar',
  requires_screening boolean not null default false,          -- D-07
  kit_template_id   uuid references public.kit_templates(id) on delete set null,
  status            course_status not null default 'DRAFT',
  created_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.course_modules (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references public.courses(id) on delete cascade,
  order_index       smallint not null check (order_index >= 0),
  title             varchar(240) not null,
  objectives        text,
  estimated_minutes smallint check (estimated_minutes > 0),
  visibility        module_visibility not null default 'ENROLLED',
  constraint uq_course_module_order unique (course_id, order_index)
);

create table public.course_module_materials (
  id               uuid primary key default gen_random_uuid(),
  course_module_id uuid not null references public.course_modules(id) on delete cascade,
  media_asset_id   uuid not null references public.media_assets(id)   on delete restrict,
  title            varchar(240) not null,
  visibility       material_visibility not null default 'ENROLLED',
  order_index      smallint not null default 0
);

create table public.cohorts (
  id                       uuid primary key default gen_random_uuid(),
  course_id                uuid not null references public.courses(id) on delete restrict,
  code                     varchar(40) not null unique,
  capacity                 smallint not null check (capacity > 0),
  waitlist_capacity        smallint not null default 0 check (waitlist_capacity >= 0),
  application_opens_at     timestamptz,
  application_closes_at    timestamptz,
  starts_on                date,
  ends_on                  date,
  offer_confirmation_hours smallint not null default 72 check (offer_confirmation_hours > 0),  -- BR-04
  min_attendance_pct       smallint not null default 75
                           check (min_attendance_pct between 0 and 100),                       -- BR-05
  status                   cohort_status not null default 'DRAFT',
  created_by               uuid references public.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  constraint ck_cohort_window  check (application_closes_at is null or application_opens_at is null
                                      or application_closes_at > application_opens_at),
  constraint ck_cohort_dates   check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.cohort_sessions (
  id               uuid primary key default gen_random_uuid(),
  cohort_id        uuid not null references public.cohorts(id) on delete cascade,
  session_no       smallint not null check (session_no > 0),
  course_module_id uuid references public.course_modules(id) on delete set null,
  scheduled_at     timestamptz not null,
  duration_minutes smallint not null check (duration_minutes > 0),
  location         varchar(200),
  status           cohort_session_status not null default 'PLANNED',
  constraint uq_cohort_session_no unique (cohort_id, session_no)
);

create table public.rejection_reasons (
  id        uuid primary key default gen_random_uuid(),
  code      varchar(40)  not null unique,
  text_ar   varchar(300) not null,
  text_en   varchar(300) not null,
  is_active boolean not null default true
);

create table public.applications (
  id                  uuid primary key default gen_random_uuid(),
  cohort_id           uuid not null references public.cohorts(id) on delete restrict,
  applicant_user_id   uuid not null references public.users(id)   on delete restrict,
  status              application_status not null default 'SUBMITTED',
  background_snapshot jsonb not null default '{}'::jsonb,   -- immutable copy at submission (§C.13)
  readiness_score     numeric(6,3),                         -- authored decision snapshot (§C.13 #1)
  rank_position       smallint,
  waitlist_rank       smallint,                             -- authored, A2-reorderable (§C.13 #2)
  offer_issued_at     timestamptz,
  offer_expires_at    timestamptz,
  decided_at          timestamptz,
  decided_by          uuid references public.users(id) on delete set null,
  rejection_reason_id uuid references public.rejection_reasons(id) on delete set null,
  submitted_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- UQ_APPLICATION_ACTIVE — one LIVE application per cohort per applicant
create unique index uq_application_active
  on public.applications (cohort_id, applicant_user_id)
  where status not in ('WITHDRAWN','REJECTED','DECLINED','EXPIRED');
create index ix_applications_ranking on public.applications (cohort_id, status, readiness_score desc);

create table public.application_status_history (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_status    varchar(40),
  to_status      varchar(40) not null,
  changed_by     uuid references public.users(id) on delete set null,  -- null = system (S1)
  reason         text,
  changed_at     timestamptz not null default now()
);

create table public.enrollments (
  id                       uuid primary key default gen_random_uuid(),
  application_id           uuid not null unique references public.applications(id) on delete restrict,  -- 1:1
  cohort_id                uuid not null references public.cohorts(id) on delete restrict,
  student_user_id          uuid not null references public.users(id)   on delete restrict,
  status                   enrollment_status not null default 'ACTIVE',
  enrolled_at              timestamptz not null default now(),
  completed_at             timestamptz,
  completion_marked_by     uuid references public.users(id) on delete set null,
  completion_overridden    boolean not null default false,             -- BR-05 A7 override
  completion_override_reason text,
  updated_at               timestamptz not null default now(),
  constraint ck_completion_override_justified
    check (completion_overridden = false or completion_override_reason is not null)
);
create index ix_enrollments_student on public.enrollments (student_user_id, status);

create table public.attendance_records (
  id                uuid primary key default gen_random_uuid(),
  enrollment_id     uuid not null references public.enrollments(id)     on delete cascade,
  cohort_session_id uuid not null references public.cohort_sessions(id) on delete cascade,
  state             attendance_state not null,
  recorded_by       uuid references public.users(id) on delete set null,
  recorded_at       timestamptz not null default now(),
  note              text,
  amended_at        timestamptz,
  amendment_reason  text,
  constraint uq_attendance_enrollment_session unique (enrollment_id, cohort_session_id),
  constraint ck_attendance_amendment check (amended_at is null or amendment_reason is not null)
);

-- =====================================================================================
--  SECTION 6 — MODULE M4: SCREENING, ASSESSMENT & SCORING  (11 tables)
-- =====================================================================================

create table public.topics (
  id      uuid primary key default gen_random_uuid(),
  code    varchar(40)  not null unique,
  name_ar varchar(160) not null,
  name_en varchar(160) not null
);

create table public.questions (
  id               uuid primary key default gen_random_uuid(),
  root_question_id uuid references public.questions(id) on delete set null,  -- version chain
  version          smallint not null default 1 check (version > 0),
  is_current       boolean  not null default true,
  type             question_type not null,
  stem             text not null,
  difficulty       question_difficulty not null default 'MEDIUM',
  max_score        numeric(6,2) not null check (max_score > 0),
  auto_gradable    boolean not null default true,
  grading_rubric   text,
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint ck_manual_needs_rubric check (auto_gradable = true or grading_rubric is not null)
);

create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  order_index smallint not null check (order_index >= 0),
  option_text text not null,
  is_correct  boolean not null default false,
  constraint uq_question_option_order unique (question_id, order_index)
);

create table public.question_topics (
  question_id uuid not null references public.questions(id) on delete cascade,
  topic_id    uuid not null references public.topics(id)    on delete cascade,
  primary key (question_id, topic_id)
);

create table public.screening_tests (
  id                uuid primary key default gen_random_uuid(),
  cohort_id         uuid not null unique references public.cohorts(id) on delete cascade,  -- one per cohort
  title             varchar(240) not null,
  version           smallint not null default 1,
  duration_minutes  smallint not null check (duration_minutes > 0),
  attempt_limit     smallint not null default 1 check (attempt_limit > 0),
  max_score         numeric(7,2) not null check (max_score > 0),
  pass_threshold    numeric(7,2) not null check (pass_threshold >= 0),    -- BR-02
  shuffle_questions boolean not null default true,
  shuffle_options   boolean not null default true,
  result_visibility test_result_visibility not null default 'SCORE_ONLY',
  status            screening_test_status  not null default 'DRAFT',
  created_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint ck_threshold_within_max check (pass_threshold <= max_score)
);

create table public.test_questions (
  screening_test_id uuid not null references public.screening_tests(id) on delete cascade,
  question_id       uuid not null references public.questions(id)       on delete restrict,
  question_version  smallint not null,          -- frozen version reference
  order_index       smallint not null default 0,
  weight            numeric(6,2) not null check (weight > 0),
  primary key (screening_test_id, question_id)
);

create table public.test_attempts (
  id                uuid primary key default gen_random_uuid(),
  screening_test_id uuid not null references public.screening_tests(id) on delete restrict,
  application_id    uuid not null references public.applications(id)    on delete cascade,
  attempt_no        smallint not null check (attempt_no > 0),
  started_at        timestamptz not null default now(),
  deadline_at       timestamptz not null,        -- server authoritative
  submitted_at      timestamptz,
  auto_submitted    boolean not null default false,
  raw_score         numeric(7,2),
  normalized_score  numeric(6,3),                -- authored decision snapshot (§C.13 #1)
  state             test_attempt_state not null default 'IN_PROGRESS',
  constraint uq_attempt_application_no unique (application_id, attempt_no)
);

create table public.attempt_answers (
  id                 uuid primary key default gen_random_uuid(),
  test_attempt_id    uuid not null references public.test_attempts(id)   on delete cascade,
  question_id        uuid not null references public.questions(id)       on delete restrict,
  selected_option_id uuid references public.question_options(id)         on delete set null,
  answer_payload     jsonb,                     -- multi-choice / numeric / text / code
  auto_score         numeric(6,2),
  awarded_score      numeric(6,2),
  graded_by          uuid references public.users(id) on delete set null,
  graded_at          timestamptz,
  grader_comment     text,
  is_override        boolean not null default false,
  original_score     numeric(6,2),
  override_reason    text,
  constraint uq_answer_attempt_question unique (test_attempt_id, question_id),
  constraint ck_answer_override_justified
    check (is_override = false or (override_reason is not null and original_score is not null))
);

create table public.readiness_models (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.cohorts(id) on delete cascade,
  name       varchar(160) not null,
  is_active  boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index uq_readiness_model_active on public.readiness_models (cohort_id) where is_active;

create table public.readiness_factors (
  id                 uuid primary key default gen_random_uuid(),
  readiness_model_id uuid not null references public.readiness_models(id) on delete cascade,
  factor_code        varchar(60) not null,      -- TEST_SCORE ACADEMIC_YEAR PRIOR_EXPERIENCE MOTIVATION
  weight_pct         smallint not null check (weight_pct between 0 and 100),
  value_source       readiness_value_source not null,
  constraint uq_readiness_factor_code unique (readiness_model_id, factor_code)
);

create table public.application_score_factors (
  application_id      uuid not null references public.applications(id)      on delete cascade,
  readiness_factor_id uuid not null references public.readiness_factors(id) on delete restrict,
  raw_value           numeric(10,3),
  weighted_value      numeric(10,3),
  computed_at         timestamptz not null default now(),
  primary key (application_id, readiness_factor_id)
);

-- =====================================================================================
--  SECTION 7 — MODULE M7: PROJECTS REPOSITORY  (6 tables)
-- =====================================================================================

create table public.projects (
  id                   uuid primary key default gen_random_uuid(),
  code                 varchar(40) not null unique,
  title_ar             varchar(240) not null,
  title_en             varchar(240) not null,
  abstract             text,
  problem_statement    text,
  status               project_status not null default 'IDEA',
  start_on             date,
  end_on               date,
  outcome              text,
  cover_media_id       uuid references public.media_assets(id) on delete set null,
  publication_status   publication_status not null default 'DRAFT',   -- D-08 / BR-11
  scheduled_publish_at timestamptz,
  published_at         timestamptz,
  published_by         uuid references public.users(id) on delete set null,
  created_by           uuid references public.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  constraint ck_project_published_stamped
    check (publication_status <> 'PUBLISHED' or published_at is not null)
);

create table public.project_members (
  project_id       uuid not null references public.projects(id) on delete cascade,
  user_id          uuid not null references public.users(id)    on delete restrict,
  role_in_project  project_member_role not null,
  contribution_note text,
  primary key (project_id, user_id)
);

create table public.technologies (
  id       uuid primary key default gen_random_uuid(),
  name     varchar(120) not null unique,
  category varchar(80)
);

create table public.project_technologies (
  project_id    uuid not null references public.projects(id)     on delete cascade,
  technology_id uuid not null references public.technologies(id) on delete restrict,
  primary key (project_id, technology_id)
);

create table public.project_bom_lines (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id)     on delete cascade,
  asset_type_id uuid not null references public.asset_types(id)  on delete restrict,
  quantity      integer not null check (quantity > 0),
  note          text,
  constraint uq_bom_project_type unique (project_id, asset_type_id)
);

create table public.project_media (
  project_id     uuid not null references public.projects(id)      on delete cascade,
  media_asset_id uuid not null references public.media_assets(id)  on delete restrict,
  caption        varchar(300),
  order_index    smallint not null default 0,
  visibility     project_media_visibility not null default 'PUBLIC',
  primary key (project_id, media_asset_id)
);

-- =====================================================================================
--  SECTION 8 — MODULE M8: EVENTS, WORKSHOPS & HACKATHONS  (4 tables)
-- =====================================================================================

create table public.venues (
  id            uuid primary key default gen_random_uuid(),
  name          varchar(200) not null unique,
  capacity      smallint check (capacity > 0),
  location_note text
);
comment on table public.venues is
  'Physical venues. The club HQ record carries its map coordinates in system_policies key '
  '''club.location'' — see SECTION 13 seed. Google Maps is a presentation concern, not an entity.';

create table public.events (
  id                       uuid primary key default gen_random_uuid(),
  code                     varchar(40) not null unique,
  type                     event_type not null,
  title_ar                 varchar(240) not null,
  title_en                 varchar(240) not null,
  description              text,
  starts_at                timestamptz not null,
  ends_at                  timestamptz not null,
  venue_id                 uuid references public.venues(id) on delete set null,
  organizing_department_id uuid references public.departments(id) on delete restrict,
  target_audience          varchar(200),
  capacity                 smallint check (capacity > 0),
  waitlist_capacity        smallint not null default 0 check (waitlist_capacity >= 0),
  registration_opens_at    timestamptz,
  registration_closes_at   timestamptz,
  cancellation_cutoff_at   timestamptz,
  eligibility              event_eligibility not null default 'PUBLIC',
  status                   event_status not null default 'PLANNED',
  cancel_reason            text,
  publication_status       publication_status not null default 'DRAFT',  -- D-08 / BR-11
  published_at             timestamptz,
  created_by               uuid references public.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  constraint ck_event_window   check (ends_at > starts_at),
  constraint ck_event_cancelled_reason
    check (status <> 'CANCELLED' or cancel_reason is not null)
);

create table public.event_sessions (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  title           varchar(240) not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  room            varchar(120),
  track           varchar(120),
  speaker_name    varchar(200),
  speaker_user_id uuid references public.users(id) on delete set null,
  constraint ck_event_session_window check (ends_at > starts_at),
  -- EX_SESSION_ROOM_OVERLAP — US-EVT-02 venue conflict detection
  constraint ex_session_room_overlap exclude using gist (
    room with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (room is not null)
);

create table public.event_registrations (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  attendee_user_id  uuid references public.users(id) on delete set null,   -- null = guest walk-in
  guest_name        varchar(200),
  guest_email       varchar(240),
  attendance_token  varchar(64) not null unique
                    default encode(extensions.gen_random_bytes(16), 'hex'),
  state             event_registration_state not null default 'REGISTERED',
  waitlist_rank     smallint,
  is_walk_in        boolean not null default false,
  registered_at     timestamptz not null default now(),
  cancelled_at      timestamptz,
  checked_in_at     timestamptz,
  checked_in_by     uuid references public.users(id) on delete set null,
  constraint ck_registration_identity
    check (attendee_user_id is not null or (guest_name is not null and guest_email is not null))
);
-- UQ_REGISTRATION_USER — one LIVE registration per event per user
create unique index uq_registration_user
  on public.event_registrations (event_id, attendee_user_id)
  where attendee_user_id is not null and state <> 'CANCELLED';

-- =====================================================================================
--  SECTION 9 — MODULE M5b: REQUISITION & CUSTODY  (7 tables)
-- =====================================================================================

create table public.requisitions (
  id                uuid primary key default gen_random_uuid(),
  requisition_no    varchar(40) not null unique,
  requester_user_id uuid not null references public.users(id) on delete restrict,
  purpose_type      requisition_purpose_type not null,
  cohort_id         uuid references public.cohorts(id)  on delete restrict,
  project_id        uuid references public.projects(id) on delete restrict,
  event_id          uuid references public.events(id)   on delete restrict,
  required_by       date,
  status            requisition_status not null default 'PENDING',
  reviewed_by       uuid references public.users(id) on delete set null,
  reviewed_at       timestamptz,
  review_reason     text,
  created_at        timestamptz not null default now(),
  -- CK_REQ_SINGLE_CONTEXT — BR-12: exactly one context, matching purpose_type
  constraint ck_req_single_context check (
    (purpose_type = 'COHORT'  and cohort_id is not null and project_id is null and event_id is null) or
    (purpose_type = 'PROJECT' and project_id is not null and cohort_id is null and event_id is null) or
    (purpose_type = 'EVENT'   and event_id  is not null and cohort_id is null and project_id is null)
  )
);

create table public.requisition_lines (
  id                 uuid primary key default gen_random_uuid(),
  requisition_id     uuid not null references public.requisitions(id) on delete cascade,
  asset_type_id      uuid not null references public.asset_types(id)  on delete restrict,
  quantity_requested integer not null check (quantity_requested > 0),
  quantity_approved  integer not null default 0 check (quantity_approved >= 0),
  constraint uq_requisition_line_type unique (requisition_id, asset_type_id),
  constraint ck_approved_le_requested check (quantity_approved <= quantity_requested)
);

create table public.stock_reservations (
  id                  uuid primary key default gen_random_uuid(),
  requisition_line_id uuid not null references public.requisition_lines(id) on delete cascade,
  asset_type_id       uuid not null references public.asset_types(id)       on delete restrict,
  storage_location_id uuid not null references public.storage_locations(id) on delete restrict,
  quantity            integer not null check (quantity > 0),
  expires_at          timestamptz not null,
  status              stock_reservation_status not null default 'ACTIVE',
  created_at          timestamptz not null default now()
);
create index ix_stock_reservations_active
  on public.stock_reservations (asset_type_id, storage_location_id) where status = 'ACTIVE';

create table public.checkouts (
  id                     uuid primary key default gen_random_uuid(),
  checkout_no            varchar(40) not null unique,
  custody_type           custody_type not null,
  holder_user_id         uuid not null references public.users(id) on delete restrict,  -- D-05
  enrollment_id          uuid references public.enrollments(id)  on delete restrict,
  requisition_id         uuid references public.requisitions(id) on delete restrict,
  issued_by              uuid references public.users(id) on delete set null,
  issued_at              timestamptz not null default now(),
  due_at                 timestamptz not null,
  acknowledged_at        timestamptz,
  status                 checkout_status not null default 'ACTIVE',
  issued_under_override   boolean not null default false,   -- BR-13 override of the custody block
  override_justification text,
  -- CK_CHECKOUT_CONTEXT — BR-12 / D-05
  constraint ck_checkout_context check (
    (custody_type = 'STUDENT' and enrollment_id is not null and requisition_id is null) or
    (custody_type in ('PROJECT_TEAM','EVENT_LEAD') and requisition_id is not null and enrollment_id is null)
  ),
  constraint ck_checkout_override_justified
    check (issued_under_override = false or override_justification is not null)
);
create index ix_checkouts_holder     on public.checkouts (holder_user_id, status);
create index ix_checkouts_enrollment on public.checkouts (enrollment_id) where enrollment_id is not null;

create table public.checkout_lines (
  id                  uuid primary key default gen_random_uuid(),
  checkout_id         uuid not null references public.checkouts(id)    on delete cascade,
  asset_type_id       uuid not null references public.asset_types(id)  on delete restrict,
  asset_unit_id       uuid references public.asset_units(id)           on delete restrict,
  quantity            integer not null default 1 check (quantity > 0),
  condition_at_issue  checkout_line_condition not null default 'HEALTHY',
  status              checkout_line_status    not null default 'ACTIVE',
  returned_at         timestamptz,
  received_by         uuid references public.users(id) on delete set null,
  condition_at_return asset_condition,
  inspection_notes    text,
  evidence_media_id   uuid references public.media_assets(id) on delete set null,
  -- CK_RETURN_INSPECTED — mandatory inspection (US-LOG-06)
  constraint ck_return_inspected check (
    status not in ('RETURNED','RETURNED_DAMAGED','LOST')
    or (condition_at_return is not null and received_by is not null and returned_at is not null)
  )
);
-- UQ_CHECKOUT_ACTIVE_UNIT — BR-07: at most one live custody per serialized unit
create unique index uq_checkout_active_unit
  on public.checkout_lines (asset_unit_id)
  where asset_unit_id is not null and status in ('ACTIVE','OVERDUE');
create index ix_checkout_lines_checkout on public.checkout_lines (checkout_id);

create table public.asset_incidents (
  id                uuid primary key default gen_random_uuid(),
  checkout_line_id  uuid not null references public.checkout_lines(id) on delete cascade,
  reported_by       uuid references public.users(id) on delete set null,
  description       text not null,
  evidence_media_id uuid references public.media_assets(id) on delete set null,
  status            asset_incident_status not null default 'OPEN',
  reported_at       timestamptz not null default now(),
  resolved_at       timestamptz,
  resolved_by       uuid references public.users(id) on delete set null
);

create table public.liability_records (
  id                        uuid primary key default gen_random_uuid(),
  checkout_line_id          uuid not null unique references public.checkout_lines(id) on delete restrict,
  holder_user_id            uuid not null references public.users(id) on delete restrict,
  enrollment_id             uuid references public.enrollments(id) on delete restrict,  -- null for team/event
  liability_type            liability_type not null,
  assessed_value            numeric(12,2) check (assessed_value >= 0),
  currency                  public.currency_code not null default 'SYP',
  status                    liability_status not null default 'OPEN',
  resolution_note           text,
  replacement_asset_unit_id uuid references public.asset_units(id) on delete set null,
  resolved_by               uuid references public.users(id) on delete set null,
  resolved_at               timestamptz,
  waived_by                 uuid references public.users(id) on delete set null,
  waiver_justification      text,
  created_at                timestamptz not null default now(),
  -- CK_LIABILITY_WAIVER_ACTOR — BR-06, A7-only waiver
  constraint ck_liability_waiver_actor check (
    status <> 'RESOLVED_WAIVED'
    or (waived_by is not null and waiver_justification is not null)
  )
);
create index ix_liability_open on public.liability_records (holder_user_id)
  where status in ('OPEN','UNDER_ASSESSMENT','PENDING_SETTLEMENT');

-- =====================================================================================
--  SECTION 10 — MODULE M6: CLEARANCE & CERTIFICATION  (4 tables)
--  This is the BR-01 lock. Read D-09 in the header before changing anything here.
-- =====================================================================================

create table public.clearance_records (
  id                              uuid primary key default gen_random_uuid(),
  -- UQ_CLEARANCE_ENROLLMENT — D-03: clearance is scoped PER ENROLLMENT, strictly 1:1
  enrollment_id                   uuid not null references public.enrollments(id) on delete restrict
                                  constraint uq_clearance_enrollment unique,
  status                          clearance_status not null default 'EVALUATING',
  precondition_snapshot           jsonb not null default '{}'::jsonb,  -- C1..C5 at decision time
  advisory_outstanding_elsewhere  boolean not null default false,      -- BR-13 advisory, NON-BLOCKING
  approved_by                     uuid references public.users(id) on delete set null,
  approved_at                     timestamptz,
  withheld_by                     uuid references public.users(id) on delete set null,
  withheld_at                     timestamptz,
  is_override                     boolean not null default false,
  override_justification          text,
  revoked_by                      uuid references public.users(id) on delete set null,
  revoked_at                      timestamptz,
  revoke_reason                   text,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  -- CK_CLEARANCE_OVERRIDE_JUSTIFIED — audit integrity (BR-09)
  constraint ck_clearance_override_justified
    check (is_override = false or override_justification is not null),
  -- D-09: target of the composite FK from certificates. Enables the declarative BR-01 lock.
  constraint uq_clearance_id_status unique (id, status)
);
comment on column public.clearance_records.advisory_outstanding_elsewhere is
  'BR-13 / D-04 Option C. ADVISORY ONLY. It is deliberately EXCLUDED from the approval '
  'conjunction (approval_enabled = C1 AND C2 AND C3 AND C4 AND C5) and must never gate a certificate.';

create table public.clearance_blockers (
  id                  uuid primary key default gen_random_uuid(),
  clearance_record_id uuid not null references public.clearance_records(id) on delete cascade,
  blocker_code        clearance_blocker_code not null,
  reference_entity    varchar(60),   -- 'checkout_lines' | 'liability_records' | 'asset_incidents'
  reference_id        uuid,
  detail_ar           text,
  detail_en           text,
  raised_at           timestamptz not null default now(),
  resolved_at         timestamptz
);
create index ix_clearance_blockers_open on public.clearance_blockers (clearance_record_id)
  where resolved_at is null;

create table public.certificates (
  id                      uuid primary key default gen_random_uuid(),
  -- UQ_CERT_ENROLLMENT — one certificate per enrollment (D-03)
  enrollment_id           uuid not null references public.enrollments(id) on delete restrict
                          constraint uq_cert_enrollment unique,
  clearance_record_id     uuid not null unique,          -- BR-01: NOT NULL + UNIQUE
  -- D-09 / RR-2: mirrored status, bound by composite FK below. NOT free-form data.
  clearance_status        clearance_status not null,
  serial_no               varchar(60) not null unique,
  -- BR-10: 128-bit non-guessable verification code
  verification_code       varchar(64) not null unique
                          default encode(extensions.gen_random_bytes(16), 'hex'),
  document_media_id       uuid references public.media_assets(id) on delete restrict,
  issued_at               timestamptz not null default now(),
  issued_by               uuid references public.users(id) on delete set null,
  issued_under_override   boolean not null default false,
  status                  certificate_status not null default 'ISSUED',
  supersedes_certificate_id uuid references public.certificates(id) on delete set null,
  revoked_at              timestamptz,
  revoked_by              uuid references public.users(id) on delete set null,
  revoke_reason           text,
  -- ===== CK_CERT_CLEARANCE_APPROVED — THE BR-01 LOCK (D-09) =====
  -- The composite FK makes it physically impossible to reference a clearance row that is
  -- not in an approved state, AND blocks any attempt to move that clearance out of the
  -- approved state while this certificate exists. No trigger, no application code required.
  constraint fk_cert_clearance_approved
    foreign key (clearance_record_id, clearance_status)
    references public.clearance_records (id, status)
    on update restrict on delete restrict,
  constraint ck_cert_clearance_approved
    check (clearance_status in ('APPROVED','APPROVED_BY_OVERRIDE')),
  constraint ck_cert_revoked_reason
    check (status <> 'REVOKED' or (revoked_at is not null and revoke_reason is not null))
);
comment on constraint fk_cert_clearance_approved on public.certificates is
  'BR-01 Logistical Clearance Lock, enforced declaratively (D-09, resolves RR-2). '
  'A certificate row cannot exist without an APPROVED clearance for the SAME enrollment.';

create table public.certificate_verifications (
  id                 uuid primary key default gen_random_uuid(),
  certificate_id     uuid not null references public.certificates(id) on delete cascade,
  verified_at        timestamptz not null default now(),
  source_fingerprint varchar(64)     -- salted hash; no PII retained (BR-10 public endpoint)
);

-- =====================================================================================
--  SECTION 11 — MODULE M2: CONSULTATION GATEWAY  (7 tables)
-- =====================================================================================

create table public.expertise_domains (
  id        uuid primary key default gen_random_uuid(),
  code      varchar(40)  not null unique,
  name_ar   varchar(160) not null,
  name_en   varchar(160) not null,
  is_active boolean not null default true
);

create table public.member_expertise (
  id                  uuid primary key default gen_random_uuid(),
  member_user_id      uuid not null references public.users(id) on delete cascade,
  expertise_domain_id uuid not null references public.expertise_domains(id) on delete restrict,
  proficiency         expertise_proficiency not null default 'PROFICIENT',
  evidence_project_id uuid references public.projects(id) on delete set null,
  is_available        boolean not null default true,          -- D-06: member editable
  max_concurrent_load smallint not null default 3 check (max_concurrent_load > 0),
  curated_by          uuid references public.users(id) on delete set null,  -- D-06: A4 curation
  created_at          timestamptz not null default now(),
  constraint uq_member_expertise unique (member_user_id, expertise_domain_id)
);

create table public.consultation_requests (
  id                  uuid primary key default gen_random_uuid(),
  reference_no        varchar(40) not null unique,
  requester_user_id   uuid not null references public.users(id) on delete restrict,
  title               varchar(240) not null,
  abstract            text,
  university_id       uuid references public.universities(id) on delete set null,
  supervisor_name     varchar(200),
  project_deadline_on date,
  support_type        consultation_support_type not null default 'TECHNICAL_ADVICE',
  status              consultation_status   not null default 'NEW',
  priority            consultation_priority not null default 'NORMAL',
  complexity          consultation_complexity,
  triaged_by          uuid references public.users(id) on delete set null,
  triaged_at          timestamptz,
  sla_due_at          timestamptz,                  -- BR-08
  sla_breached        boolean not null default false,
  closed_at           timestamptz,
  outcome_category    consultation_outcome,
  outcome_summary     text,
  satisfaction_rating smallint check (satisfaction_rating between 1 and 5),
  rejection_reason    text,
  created_at          timestamptz not null default now()
);
create index ix_consultation_sla on public.consultation_requests (sla_due_at)
  where status in ('NEW','TRIAGED');

create table public.consultation_request_domains (
  consultation_request_id uuid not null references public.consultation_requests(id) on delete cascade,
  expertise_domain_id     uuid not null references public.expertise_domains(id)     on delete restrict,
  primary key (consultation_request_id, expertise_domain_id)
);

create table public.consultation_assignments (
  id                      uuid primary key default gen_random_uuid(),
  consultation_request_id uuid not null references public.consultation_requests(id) on delete cascade,
  expert_user_id          uuid not null references public.users(id) on delete restrict,
  assigned_by             uuid references public.users(id) on delete set null,
  assigned_at             timestamptz not null default now(),
  response_due_at         timestamptz,
  state                   consultation_assignment_state not null default 'PENDING_ACCEPTANCE',
  decline_reason          text,
  released_at             timestamptz
);
create index ix_assignment_expert_open on public.consultation_assignments (expert_user_id)
  where state in ('PENDING_ACCEPTANCE','ACCEPTED');

create table public.consultation_messages (
  id                      uuid primary key default gen_random_uuid(),
  consultation_request_id uuid not null references public.consultation_requests(id) on delete cascade,
  sender_user_id          uuid not null references public.users(id) on delete restrict,
  body                    text not null,
  sent_at                 timestamptz not null default now(),
  read_at                 timestamptz
);

create table public.consultation_attachments (
  consultation_message_id uuid not null references public.consultation_messages(id) on delete cascade,
  media_asset_id          uuid not null references public.media_assets(id)          on delete restrict,
  filename                varchar(240),
  primary key (consultation_message_id, media_asset_id)
);

-- =====================================================================================
--  SECTION 12 — MODULE M9: MEDIA, NEWS & HALL OF FAME  (8 remaining tables)
-- =====================================================================================

create table public.article_categories (
  id      uuid primary key default gen_random_uuid(),
  code    varchar(40)  not null unique,
  name_ar varchar(160) not null,
  name_en varchar(160) not null
);

-- §C.1 Multilingual: long-form content uses ROW-PER-LOCALE + translation_group_id.
create table public.articles (
  id                   uuid primary key default gen_random_uuid(),
  slug                 varchar(200) not null,
  locale               public.locale_code not null,
  translation_group_id uuid not null default gen_random_uuid(),  -- links the ar/en pair
  title                varchar(300) not null,
  summary              text,
  body                 text,
  article_category_id  uuid references public.article_categories(id) on delete set null,
  cover_media_id       uuid references public.media_assets(id) on delete set null,
  author_user_id       uuid references public.users(id) on delete set null,
  publication_status   publication_status not null default 'DRAFT',
  scheduled_publish_at timestamptz,
  published_at         timestamptz,
  published_by         uuid references public.users(id) on delete set null,
  review_comments      text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint uq_article_slug_locale unique (slug, locale),
  constraint uq_article_group_locale unique (translation_group_id, locale)
);
create index ix_articles_published on public.articles (locale, published_at desc)
  where publication_status = 'PUBLISHED';

create table public.tags (
  id   uuid primary key default gen_random_uuid(),
  name varchar(80) not null unique
);

create table public.article_tags (
  article_id uuid not null references public.articles(id) on delete cascade,
  tag_id     uuid not null references public.tags(id)     on delete cascade,
  primary key (article_id, tag_id)
);

create table public.galleries (
  id                 uuid primary key default gen_random_uuid(),
  title              varchar(240) not null,
  description        text,
  event_id           uuid references public.events(id)   on delete set null,
  project_id         uuid references public.projects(id) on delete set null,
  publication_status publication_status not null default 'DRAFT',
  published_at       timestamptz,
  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

create table public.gallery_items (
  gallery_id     uuid not null references public.galleries(id)    on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  order_index    smallint not null default 0,
  caption        varchar(300),
  primary key (gallery_id, media_asset_id)
);

create table public.awards (
  id                 uuid primary key default gen_random_uuid(),
  title              varchar(240) not null,
  awarding_body      varchar(200),
  competition        varchar(200),
  level              award_level not null default 'LOCAL',
  rank_place         varchar(60),
  awarded_on         date,
  project_id         uuid references public.projects(id) on delete set null,
  event_id           uuid references public.events(id)   on delete set null,
  evidence_media_id  uuid references public.media_assets(id) on delete set null,
  publication_status publication_status not null default 'DRAFT',
  published_at       timestamptz,
  created_at         timestamptz not null default now()
);

create table public.award_recipients (
  award_id  uuid not null references public.awards(id) on delete cascade,
  user_id   uuid not null references public.users(id)  on delete restrict,
  role_note varchar(200),
  primary key (award_id, user_id)
);

-- =====================================================================================
--  SECTION 13 — TRIGGERS: updated_at, weight invariants, attempt limit, audit lock
-- =====================================================================================

create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'users','student_profiles','member_profiles','system_policies','notification_templates',
    'bulk_stock','courses','cohorts','applications','enrollments','clearance_records','articles'
  ] loop
    execute format(
      'create trigger trg_%1$s_touch before update on public.%1$I
         for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;

-- CK_FACTOR_WEIGHTS_100 — US-TRN-06: readiness factor weights must total exactly 100 per model
create or replace function app.assert_factor_weights_100() returns trigger
language plpgsql as $$
declare v_model uuid; v_total int;
begin
  v_model := coalesce(new.readiness_model_id, old.readiness_model_id);
  select coalesce(sum(weight_pct), 0) into v_total
    from public.readiness_factors where readiness_model_id = v_model;
  -- Only enforced once the parent model is activated; drafts may be incomplete.
  if v_total <> 100 and exists (
       select 1 from public.readiness_models where id = v_model and is_active) then
    raise exception 'CK_FACTOR_WEIGHTS_100: weights for model % total % percent, must total 100',
      v_model, v_total;
  end if;
  return null;
end $$;

create constraint trigger trg_factor_weights_100
  after insert or update or delete on public.readiness_factors
  deferrable initially deferred
  for each row execute function app.assert_factor_weights_100();

-- CK_TEST_WEIGHTS_MATCH — US-TRN-05: sum(test_questions.weight) must equal screening_tests.max_score
create or replace function app.assert_test_weights_match() returns trigger
language plpgsql as $$
declare v_test uuid; v_sum numeric; v_max numeric; v_status screening_test_status;
begin
  v_test := coalesce(new.screening_test_id, old.screening_test_id);
  select max_score, status into v_max, v_status
    from public.screening_tests where id = v_test;
  if v_status is null or v_status = 'DRAFT' then
    return null;   -- drafts may be under construction
  end if;
  select coalesce(sum(weight), 0) into v_sum
    from public.test_questions where screening_test_id = v_test;
  if v_sum <> v_max then
    raise exception 'CK_TEST_WEIGHTS_MATCH: test % weights total %, expected %', v_test, v_sum, v_max;
  end if;
  return null;
end $$;

create constraint trigger trg_test_weights_match
  after insert or update or delete on public.test_questions
  deferrable initially deferred
  for each row execute function app.assert_test_weights_match();

-- UQ_ATTEMPT_LIMIT — US-STU-09: attempts must not exceed screening_tests.attempt_limit
create or replace function app.assert_attempt_limit() returns trigger
language plpgsql as $$
declare v_limit smallint; v_count int;
begin
  select attempt_limit into v_limit
    from public.screening_tests where id = new.screening_test_id;
  select count(*) into v_count
    from public.test_attempts
    where application_id = new.application_id
      and screening_test_id = new.screening_test_id
      and state <> 'VOIDED';
  if v_count > v_limit then
    raise exception 'UQ_ATTEMPT_LIMIT: application % exceeded attempt limit of %',
      new.application_id, v_limit;
  end if;
  return null;
end $$;

create trigger trg_attempt_limit
  after insert on public.test_attempts
  for each row execute function app.assert_attempt_limit();

-- CK_LINE_SERIALIZATION — inventory integrity. Cross-table (needs asset_types.tracking_mode),
-- so it cannot be a CHECK constraint and is enforced as a row trigger instead.
create or replace function app.assert_line_serialization() returns trigger
language plpgsql as $$
declare v_mode asset_tracking_mode;
begin
  select tracking_mode into v_mode from public.asset_types where id = new.asset_type_id;
  if v_mode = 'SERIALIZED' and (new.asset_unit_id is null or new.quantity <> 1) then
    raise exception
      'CK_LINE_SERIALIZATION: serialized asset type % requires asset_unit_id and quantity = 1',
      new.asset_type_id;
  end if;
  if v_mode = 'BULK' and new.asset_unit_id is not null then
    raise exception
      'CK_LINE_SERIALIZATION: bulk asset type % must not carry an asset_unit_id',
      new.asset_type_id;
  end if;
  return new;
end $$;

create trigger trg_line_serialization
  before insert or update of asset_type_id, asset_unit_id, quantity on public.checkout_lines
  for each row execute function app.assert_line_serialization();

-- CK_AUDIT_APPEND_ONLY — BR-09: audit_logs may only ever be inserted.
create or replace function app.reject_audit_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'CK_AUDIT_APPEND_ONLY: audit_logs is append-only (BR-09)';
end $$;

create trigger trg_audit_append_only
  before update or delete on public.audit_logs
  for each row execute function app.reject_audit_mutation();

-- =====================================================================================
--  SECTION 14 — DERIVED VIEWS (§C.12) — never stored as columns
--  security_invoker = on  =>  RLS of the underlying tables still applies to the caller.
-- =====================================================================================

create view public.v_enrollment_attendance with (security_invoker = on) as
select e.id                                   as enrollment_id,
       e.cohort_id,
       count(distinct cs.id)                  as sessions_held,
       count(distinct ar.id) filter (where ar.state in ('PRESENT','LATE','EXCUSED')) as sessions_attended,
       case when count(distinct cs.id) = 0 then 0
            else round(100.0 * count(distinct ar.id)
                       filter (where ar.state in ('PRESENT','LATE','EXCUSED'))
                       / count(distinct cs.id), 2)
       end                                    as attendance_pct
from public.enrollments e
join public.cohort_sessions cs on cs.cohort_id = e.cohort_id and cs.status = 'HELD'
left join public.attendance_records ar on ar.enrollment_id = e.id and ar.cohort_session_id = cs.id
group by e.id, e.cohort_id;

create view public.v_asset_availability with (security_invoker = on) as
select at.id as asset_type_id,
       at.name,
       at.tracking_mode,
       coalesce(su.serialized_available, 0) as serialized_available,
       coalesce(bs.on_hand, 0) - coalesce(bs.reserved, 0) - coalesce(sr.active_reserved, 0)
                                            as bulk_available
from public.asset_types at
left join lateral (
  select count(*) as serialized_available from public.asset_units u
   where u.asset_type_id = at.id and u.status = 'AVAILABLE'
) su on true
left join lateral (
  select sum(quantity_on_hand) as on_hand, sum(quantity_reserved) as reserved
    from public.bulk_stock b where b.asset_type_id = at.id
) bs on true
left join lateral (
  select sum(quantity) as active_reserved from public.stock_reservations r
   where r.asset_type_id = at.id and r.status = 'ACTIVE' and r.expires_at > now()
) sr on true;

create view public.v_expert_current_load with (security_invoker = on) as
select me.member_user_id,
       me.max_concurrent_load,
       count(ca.id) filter (where ca.state in ('PENDING_ACCEPTANCE','ACCEPTED')) as current_load
from public.member_expertise me
left join public.consultation_assignments ca on ca.expert_user_id = me.member_user_id
group by me.member_user_id, me.max_concurrent_load;

create view public.v_event_attendance_metrics with (security_invoker = on) as
select e.id as event_id,
       count(r.id) filter (where r.state = 'REGISTERED')  as registered_count,
       count(r.id) filter (where r.state = 'WAITLISTED')  as waitlisted_count,
       count(r.id) filter (where r.state = 'ATTENDED')    as attended_count,
       count(r.id) filter (where r.state = 'NO_SHOW')     as no_show_count,
       case when count(r.id) filter (where r.state in ('ATTENDED','NO_SHOW')) = 0 then 0
            else round(100.0 * count(r.id) filter (where r.state = 'ATTENDED')
                       / count(r.id) filter (where r.state in ('ATTENDED','NO_SHOW')), 2)
       end as attendance_rate_pct
from public.events e
left join public.event_registrations r on r.event_id = e.id
group by e.id;

create view public.v_cohort_funnel with (security_invoker = on) as
select c.id as cohort_id,
       c.capacity,
       count(a.id)                                              as total_applications,
       count(a.id) filter (where a.status = 'OFFERED')          as offered,
       count(a.id) filter (where a.status = 'WAITLISTED')       as waitlisted,
       count(a.id) filter (where a.status = 'ENROLLED')         as enrolled,
       count(a.id) filter (where a.status = 'REJECTED')         as rejected,
       count(a.id) filter (where a.status = 'EXPIRED')          as expired
from public.cohorts c
left join public.applications a on a.cohort_id = c.id
group by c.id, c.capacity;

-- BR-13 advisory source. Read by the clearance screen; NEVER by the certificate guard.
create view public.v_holder_open_liabilities with (security_invoker = on) as
select lr.holder_user_id,
       count(*)                as open_liability_count,
       sum(lr.assessed_value)  as open_assessed_value,
       array_agg(lr.id)        as liability_ids
from public.liability_records lr
where lr.status in ('OPEN','UNDER_ASSESSMENT','PENDING_SETTLEMENT')
group by lr.holder_user_id;

-- RR-3 CONFIRMED: consumables are excluded from the return obligation, so the BR-01
-- C2/C3 evaluation must filter them out. This view is the single source of that truth.
create view public.v_enrollment_outstanding_items with (security_invoker = on) as
select co.enrollment_id,
       cl.id            as checkout_line_id,
       cl.status        as line_status,
       at.name          as asset_name,
       at.is_consumable
from public.checkouts co
join public.checkout_lines cl on cl.checkout_id = co.id
join public.asset_types  at  on at.id = cl.asset_type_id
where co.enrollment_id is not null
  and at.is_consumable = false                      -- RR-3
  and (cl.status in ('ACTIVE','OVERDUE') or cl.condition_at_return is null);

-- =====================================================================================
--  SECTION 15 — RLS HELPER FUNCTIONS
--  SECURITY DEFINER so that policies reading user_roles do not recurse into their own RLS.
-- =====================================================================================

create or replace function app.uid() returns uuid
language sql stable as $$ select auth.uid() $$;

create or replace function app.has_perm(p_code text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
      from user_roles ur
      join role_permissions rp on rp.role_id = ur.role_id
      join permissions p       on p.id = rp.permission_id
     where ur.user_id = auth.uid()
       and ur.revoked_at is null
       and (ur.expires_at is null or ur.expires_at > now())
       and p.code = p_code
  );
$$;

create or replace function app.has_role(p_role_code text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from user_roles ur join roles r on r.id = ur.role_id
     where ur.user_id = auth.uid()
       and ur.revoked_at is null
       and (ur.expires_at is null or ur.expires_at > now())
       and r.code = p_role_code
  );
$$;

create or replace function app.is_admin() returns boolean
language sql stable as $$ select app.has_role('ADMIN') $$;

create or replace function app.is_member() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from users u
     where u.id = auth.uid() and u.user_type = 'MEMBER' and u.status = 'ACTIVE'
  );
$$;

-- Is the caller the student behind this enrollment?
create or replace function app.owns_enrollment(p_enrollment_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from enrollments e
     where e.id = p_enrollment_id and e.student_user_id = auth.uid()
  );
$$;

grant execute on all functions in schema app to authenticated, anon;

-- =====================================================================================
--  SECTION 16 — SEED: departments, roles, permission matrix, club location
-- =====================================================================================

insert into public.departments (code, name_ar, name_en, mandate) values
  ('TRAINING',  'فريق التدريب',   'Training Team',   'Curriculum, screening, evaluation, enrollment decisions, attendance.'),
  ('LOGISTICS', 'فريق اللوجستيات','Logistics Team',  'Asset catalogue, checkout, check-in, condition logging, clearance issuance.'),
  ('PROJECTS',  'فريق المشاريع',  'Projects Team',   'Project records, consultation triage, team hardware requisition.'),
  ('EVENTS',    'فريق الفعاليات', 'Events Team',     'Workshops, exhibitions, hackathons, scheduling, attendance metrics.'),
  ('MEDIA',     'فريق الإعلام',   'Media Team',      'News, technical articles, galleries, awards and hall of fame.'),
  ('ADMIN',     'إدارة النادي',   'Club Management', 'Oversight, RBAC administration, cross-departmental KPIs, override authority.');

insert into public.roles (code, name_ar, name_en, description, is_system) values
  ('ADMIN',     'مدير النظام',      'System Admin',    'A7 — full oversight and override authority.', true),
  ('TRAINING',  'عضو فريق التدريب', 'Training Member', 'A2 — academic lifecycle.',  true),
  ('LOGISTICS', 'عضو فريق اللوجستيات','Logistics Member','A3 — physical assets and clearance.', true),
  ('PROJECTS',  'عضو فريق المشاريع','Projects Member', 'A4 — projects and consultations.', true),
  ('EVENTS',    'عضو فريق الفعاليات','Events Member',  'A5 — events and workshops.', true),
  ('MEDIA',     'عضو فريق الإعلام', 'Media Member',    'A6 — content and publication.', true),
  ('STUDENT',   'طالب مسجّل',       'Registered Student','A1 — self-service portal access.', true);

-- Full module x action permission matrix (M1..M10 x 7 actions = 70 permissions)
insert into public.permissions (code, module, action, description)
select m || '.' || a::text, m, a, 'Auto-generated permission ' || m || '.' || a::text
from   unnest(array['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10']) as m
cross join unnest(enum_range(null::permission_action)) as a;

-- A7 generalizes A2..A6 (§1.3): ADMIN receives every permission.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.code = 'ADMIN';

-- Departmental roles receive CRUD + APPROVE + EXPORT on their owning modules only.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join (values
  ('TRAINING',  array['M3','M4']),
  ('LOGISTICS', array['M5','M6']),
  ('PROJECTS',  array['M2','M7']),
  ('EVENTS',    array['M8']),
  ('MEDIA',     array['M1','M9'])
) as m(role_code, modules) on m.role_code = r.code
join public.permissions p
  on p.module = any (m.modules)
 and p.action in ('CREATE','READ','UPDATE','DELETE','APPROVE','EXPORT');

-- Cross-module READ so departments can see the context they operate in.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.action = 'READ'
where r.code in ('TRAINING','LOGISTICS','PROJECTS','EVENTS','MEDIA')
on conflict do nothing;

-- Interactive Google Maps location of the club HQ (presentation config, not an entity).
insert into public.system_policies (key, value, description) values
  ('club.location', jsonb_build_object(
      'address_ar', 'دمشق - طريق المطار - كلية الهندسة الميكانيكية والكهربائية (همك) - البناء الأحمر - قاعة المطالعة',
      'address_en', 'Damascus - Airport Road - Faculty of Mechanical & Electrical Engineering (HMK) - The Red Building - Reading Hall',
      'maps_url',   'https://maps.app.goo.gl/1tc3fxDkdtTkk4KKA',
      'lat', null, 'lng', null),
   'Club HQ address + Google Maps deep link rendered by the public contact page.'),
  ('admissions.default_offer_confirmation_hours', '72'::jsonb,        'BR-04 default offer window.'),
  ('consultations.sla_hours',                     '48'::jsonb,        'BR-08 triage SLA.'),
  ('custody.default_loan_days',                   '14'::jsonb,        'Default due_at horizon for checkouts.'),
  ('i18n.supported_locales',                      '["ar","en"]'::jsonb,'Dual-language support; ar is RTL default.'),
  ('i18n.default_locale',                         '"ar"'::jsonb,      'Default locale on first visit.');
-- =====================================================================================
--  SECTION 17 — ROW LEVEL SECURITY
--  Model: deny-by-default. Every table gets RLS + an admin-full policy, then explicit
--  additive policies for public reads, self-service reads and departmental writes.
-- =====================================================================================

do $$
declare t text;
begin
  foreach t in array array[
    -- M10
    'users','student_profiles','member_profiles','universities','departments','roles',
    'permissions','role_permissions','user_roles','audit_logs','system_policies',
    'notification_templates','notifications',
    -- M9
    'media_assets','article_categories','articles','tags','article_tags','galleries',
    'gallery_items','awards','award_recipients',
    -- M5
    'asset_categories','asset_types','storage_locations','asset_units','bulk_stock',
    'kit_templates','kit_template_items','requisitions','requisition_lines',
    'stock_reservations','checkouts','checkout_lines','asset_incidents','liability_records',
    -- M3
    'courses','course_modules','course_module_materials','cohorts','cohort_sessions',
    'rejection_reasons','applications','application_status_history','enrollments','attendance_records',
    -- M4
    'topics','questions','question_options','question_topics','screening_tests','test_questions',
    'test_attempts','attempt_answers','readiness_models','readiness_factors','application_score_factors',
    -- M6
    'clearance_records','clearance_blockers','certificates','certificate_verifications',
    -- M2
    'expertise_domains','member_expertise','consultation_requests','consultation_request_domains',
    'consultation_assignments','consultation_messages','consultation_attachments',
    -- M7
    'projects','project_members','technologies','project_technologies','project_bom_lines','project_media',
    -- M8
    'venues','events','event_sessions','event_registrations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy "admin_full_access" on public.%I for all to authenticated
         using (app.is_admin()) with check (app.is_admin())', t);
  end loop;
end $$;

-- ---------- Public (anonymous) reads — D-08 / BR-11: only PUBLISHED content is reachable
create policy "public_read_published_courses" on public.courses
  for select to anon, authenticated using (status = 'PUBLISHED');

create policy "public_read_open_cohorts" on public.cohorts
  for select to anon, authenticated using (status in ('OPEN','RUNNING','FINISHED'));

create policy "public_read_public_modules" on public.course_modules
  for select to anon, authenticated using (visibility = 'PUBLIC');

create policy "public_read_published_projects" on public.projects
  for select to anon, authenticated using (publication_status = 'PUBLISHED');

create policy "public_read_published_events" on public.events
  for select to anon, authenticated using (publication_status = 'PUBLISHED');

create policy "public_read_published_articles" on public.articles
  for select to anon, authenticated using (publication_status = 'PUBLISHED');

create policy "public_read_published_galleries" on public.galleries
  for select to anon, authenticated using (publication_status = 'PUBLISHED');

create policy "public_read_published_awards" on public.awards
  for select to anon, authenticated using (publication_status = 'PUBLISHED');

-- Reference lists needed to render public pages
do $$
declare t text;
begin
  foreach t in array array[
    'universities','departments','venues','technologies','tags','article_categories',
    'expertise_domains','asset_categories','topics'
  ] loop
    execute format(
      'create policy "public_read_reference" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- BR-10: certificate verification is deliberately reachable WITHOUT authentication.
create policy "public_verify_certificate" on public.certificates
  for select to anon, authenticated using (status in ('ISSUED','REISSUED'));

create policy "public_log_verification" on public.certificate_verifications
  for insert to anon, authenticated with check (true);

-- ---------- Self-service (A1 — the authenticated external student)
create policy "self_read_profile" on public.users
  for select to authenticated using (id = app.uid() or app.has_perm('M10.READ'));
create policy "self_update_profile" on public.users
  for update to authenticated using (id = app.uid()) with check (id = app.uid());

create policy "self_student_profile" on public.student_profiles
  for all to authenticated using (user_id = app.uid()) with check (user_id = app.uid());

create policy "self_read_notifications" on public.notifications
  for select to authenticated using (recipient_user_id = app.uid());
create policy "self_mark_notification_read" on public.notifications
  for update to authenticated using (recipient_user_id = app.uid()) with check (recipient_user_id = app.uid());

create policy "self_read_applications" on public.applications
  for select to authenticated using (applicant_user_id = app.uid() or app.has_perm('M3.READ'));
create policy "self_create_application" on public.applications
  for insert to authenticated with check (applicant_user_id = app.uid());

create policy "self_read_enrollments" on public.enrollments
  for select to authenticated using (student_user_id = app.uid() or app.has_perm('M3.READ'));

create policy "self_read_attendance" on public.attendance_records
  for select to authenticated
  using (app.owns_enrollment(enrollment_id) or app.has_perm('M3.READ'));

create policy "self_read_checkouts" on public.checkouts
  for select to authenticated using (holder_user_id = app.uid() or app.has_perm('M5.READ'));
create policy "self_read_checkout_lines" on public.checkout_lines
  for select to authenticated using (
    app.has_perm('M5.READ')
    or exists (select 1 from public.checkouts c
                where c.id = checkout_lines.checkout_id and c.holder_user_id = app.uid())
  );

create policy "self_read_liabilities" on public.liability_records
  for select to authenticated using (holder_user_id = app.uid() or app.has_perm('M5.READ'));

create policy "self_read_clearance" on public.clearance_records
  for select to authenticated
  using (app.owns_enrollment(enrollment_id) or app.has_perm('M6.READ'));
create policy "self_read_blockers" on public.clearance_blockers
  for select to authenticated using (
    app.has_perm('M6.READ')
    or exists (select 1 from public.clearance_records cr
                where cr.id = clearance_blockers.clearance_record_id
                  and app.owns_enrollment(cr.enrollment_id))
  );

create policy "self_read_test_attempts" on public.test_attempts
  for select to authenticated using (
    app.has_perm('M4.READ')
    or exists (select 1 from public.applications a
                where a.id = test_attempts.application_id and a.applicant_user_id = app.uid())
  );
create policy "self_answer_test" on public.attempt_answers
  for all to authenticated using (
    exists (select 1 from public.test_attempts ta join public.applications a on a.id = ta.application_id
             where ta.id = attempt_answers.test_attempt_id
               and a.applicant_user_id = app.uid() and ta.state = 'IN_PROGRESS')
  ) with check (
    exists (select 1 from public.test_attempts ta join public.applications a on a.id = ta.application_id
             where ta.id = attempt_answers.test_attempt_id
               and a.applicant_user_id = app.uid() and ta.state = 'IN_PROGRESS')
  );

create policy "self_read_own_certificate" on public.certificates
  for select to authenticated using (app.owns_enrollment(enrollment_id) or app.has_perm('M6.READ'));

create policy "self_consultations" on public.consultation_requests
  for select to authenticated using (
    requester_user_id = app.uid()
    or app.has_perm('M2.READ')
    or exists (select 1 from public.consultation_assignments ca
                where ca.consultation_request_id = consultation_requests.id
                  and ca.expert_user_id = app.uid())
  );
create policy "self_create_consultation" on public.consultation_requests
  for insert to authenticated with check (requester_user_id = app.uid());

create policy "participants_read_messages" on public.consultation_messages
  for select to authenticated using (
    app.has_perm('M2.READ')
    or exists (select 1 from public.consultation_requests cr
                where cr.id = consultation_messages.consultation_request_id
                  and cr.requester_user_id = app.uid())
    or exists (select 1 from public.consultation_assignments ca
                where ca.consultation_request_id = consultation_messages.consultation_request_id
                  and ca.expert_user_id = app.uid())
  );
create policy "participants_send_messages" on public.consultation_messages
  for insert to authenticated with check (sender_user_id = app.uid());

create policy "self_event_registration" on public.event_registrations
  for select to authenticated using (attendee_user_id = app.uid() or app.has_perm('M8.READ'));
create policy "self_register_event" on public.event_registrations
  for insert to authenticated with check (attendee_user_id = app.uid());

-- ---------- Departmental writes, driven by the live permission matrix (BR-09)
do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('courses','M3'), ('course_modules','M3'), ('course_module_materials','M3'),
      ('cohorts','M3'), ('cohort_sessions','M3'), ('rejection_reasons','M3'),
      ('applications','M3'), ('application_status_history','M3'), ('enrollments','M3'),
      ('attendance_records','M3'),
      ('topics','M4'), ('questions','M4'), ('question_options','M4'), ('question_topics','M4'),
      ('screening_tests','M4'), ('test_questions','M4'), ('test_attempts','M4'),
      ('attempt_answers','M4'), ('readiness_models','M4'), ('readiness_factors','M4'),
      ('application_score_factors','M4'),
      ('asset_categories','M5'), ('asset_types','M5'), ('storage_locations','M5'),
      ('asset_units','M5'), ('bulk_stock','M5'), ('kit_templates','M5'), ('kit_template_items','M5'),
      ('requisitions','M5'), ('requisition_lines','M5'), ('stock_reservations','M5'),
      ('checkouts','M5'), ('checkout_lines','M5'), ('asset_incidents','M5'), ('liability_records','M5'),
      ('clearance_records','M6'), ('clearance_blockers','M6'), ('certificates','M6'),
      ('expertise_domains','M2'), ('member_expertise','M2'), ('consultation_requests','M2'),
      ('consultation_request_domains','M2'), ('consultation_assignments','M2'),
      ('projects','M7'), ('project_members','M7'), ('technologies','M7'),
      ('project_technologies','M7'), ('project_bom_lines','M7'), ('project_media','M7'),
      ('venues','M8'), ('events','M8'), ('event_sessions','M8'), ('event_registrations','M8'),
      ('media_assets','M9'), ('article_categories','M9'), ('articles','M9'), ('tags','M9'),
      ('article_tags','M9'), ('galleries','M9'), ('gallery_items','M9'), ('awards','M9'),
      ('award_recipients','M9')
    ) as v(tbl, module)
  loop
    execute format(
      'create policy "staff_read" on public.%I for select to authenticated using (app.has_perm(%L))',
      spec.tbl, spec.module || '.READ');
    execute format(
      'create policy "staff_create" on public.%I for insert to authenticated with check (app.has_perm(%L))',
      spec.tbl, spec.module || '.CREATE');
    execute format(
      'create policy "staff_update" on public.%I for update to authenticated
         using (app.has_perm(%L)) with check (app.has_perm(%L))',
      spec.tbl, spec.module || '.UPDATE', spec.module || '.UPDATE');
    execute format(
      'create policy "staff_delete" on public.%I for delete to authenticated using (app.has_perm(%L))',
      spec.tbl, spec.module || '.DELETE');
  end loop;
end $$;

-- BR-09: audit_logs is readable only by A7 and insertable by any authenticated actor.
create policy "audit_insert" on public.audit_logs
  for insert to authenticated with check (true);
create policy "audit_read_admin" on public.audit_logs
  for select to authenticated using (app.has_perm('M10.READ'));
revoke update, delete on public.audit_logs from authenticated, anon;


commit;

-- =====================================================================================
--  POST-DEPLOY NOTES
--  1. `lat`/`lng` in system_policies['club.location'] are null until the club confirms
--     the exact pin. The map component falls back to the maps_url deep link meanwhile.
--  2. Storage buckets are NOT created here. Required buckets: 'certificates' (private,
--     versioned — RR-4), 'media' (public), 'evidence' (private).
--  3. The first ADMIN user must be granted via service_role, since RLS on user_roles
--     requires an existing admin to create one. See journals/ for the bootstrap snippet.
-- =====================================================================================
