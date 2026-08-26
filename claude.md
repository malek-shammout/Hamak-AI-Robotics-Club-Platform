# claude.md — HMK Platform Project Memory

> **Read this file at the start of every session, before touching any code.**
> It is the anti-hallucination contract for this project. If something here conflicts with
> your recollection, **this file wins**. If something is not here and not in the source-of-truth
> documents, **ask — do not invent it**.

**Project:** HMK AI & Robotics Club Platform — نادي الهمك للذكاء الصنعي والروبوتيك
**Working directory:** `E:\Full Stack X AI\Final Project`
**Last updated:** 2026-08-26 (Session 002)

---

## 0. Rules of Engagement

1. **Never invent schema.** The data model is frozen at 78 entities. Adding, renaming, or
   removing a table/column requires an explicit decision recorded in §3 of this file.
2. **Never weaken BR-01.** The clearance lock is the load-bearing rule of the whole system.
   See §4 and §5. Any change there needs the club's sign-off, in writing, in a journal entry.
3. **Cite the source.** When implementing a feature, name the UC-, US-, BR-, or D- identifier
   it comes from. If you cannot name one, you are probably building something nobody asked for.
4. **State verification status honestly.** "Written" ≠ "tested" ≠ "deployed". Say which.
5. **Bilingual is not optional.** Every user-facing string ships `ar` + `en`. A PR with an
   English-only label is incomplete, not "to be translated later".
6. **RLS is not optional.** Every new table gets RLS enabled + policies in the same change.
   A table without policies is a data leak, not a TODO.

---

## 1. Source-of-Truth Documents

| File | Contains | Status |
|---|---|---|
| `HMK_Platform_Phase1_Step1_UseCases_UserStories.md` | 7 actors, 4 system actors, 10 modules, 11 use-case diagrams, **79 user stories**, BR-01…BR-12 | Frozen, approved |
| `HMK_Platform_Phase1_Step2_Step3_Workflows_ERD.md` | Decision register D-01…D-08, BR-13, 10 activity diagrams, 8 state machines, 10 ERD modules, **78 entities**, 19 named constraints, 6 views | Frozen, approved |
| `supabase/schema.sql` | The DDL realisation of the above | **Applied to the live project** 2026-08-26; verified in-DB |
| `D:\HMK Robotics club\Visual_identify\hmkVISUAL.pdf` | Official visual identity | **Not yet machine-read** — see §8 caveat |

**Not received:** `how write prompt in Claude.zip` was referenced but never provided. Do not
pretend to have read it.

---

## 2. Actors, Modules, Trust

| ID | Actor | Role code | Owns |
|---|---|---|---|
| A1 | External Student / Visitor | `STUDENT` | Self-service portal |
| A2 | Training Team | `TRAINING` | M3, M4 |
| A3 | Logistics Team | `LOGISTICS` | M5, M6 |
| A4 | Projects Team | `PROJECTS` | M2, M7 |
| A5 | Events Team | `EVENTS` | M8 |
| A6 | Media Team | `MEDIA` | M1, M9 |
| A7 | Team Manager / System Admin | `ADMIN` | Everything + override |

System actors: **S1** Scheduler, **S2** Notification Dispatcher, **S3** Certificate Renderer &
Verification Registry, **S4** Assessment Engine.

Modules: **M1** Public Portal · **M2** Consultations · **M3** Courses & Admissions ·
**M4** Screening & Scoring · **M5** Hardware Logistics · **M6** Clearance & Certification ·
**M7** Projects · **M8** Events · **M9** Media · **M10** Identity/RBAC/Audit.

A7 generalises A2…A6 (§1.3 of Step 1) — realised as `ADMIN` holding every permission.

---

## 3. Ratified Architecture Decisions

| ID | Decision | Structural consequence |
|---|---|---|
| **D-01** | Multi-role, multi-department, expirable | `user_roles` is a table with `department_id` + `expires_at` |
| **D-02** | One identity store | `users` + `student_profiles` + `member_profiles` (1:0..1) |
| **D-03** | Clearance scoped **per enrollment** | `clearance_records.enrollment_id` UNIQUE (1:1) |
| **D-04** | Two-tier soft gate (Option C) | BR-13; liability hard-blocks *checkouts*, only advises on clearance |
| **D-05** | One accountable holder per checkout | `custody_type` + `CK_CHECKOUT_CONTEXT` |
| **D-06** | Curated expertise, member-toggled availability | `member_expertise.curated_by` + `is_available` |
| **D-07** | Screening optional per course | `courses.requires_screening` |
| **D-08** | Explicit publish transition | `publication_status` on all public entities |
| **D-09** | **NEW (Session 001).** RR-2 resolved **declaratively**, not by trigger | `certificates` mirrors `clearance_status`, bound by a **composite FK** to `clearance_records(id, status)` + a CHECK restricting it to approved states |
| **D-10** | **NEW (Session 001).** Supabase Auth owns credentials | `users.password_hash` removed; `users.id` → FK `auth.users(id)`; `token_epoch` retained for JWT invalidation |
| **D-11** | **NEW (Session 002).** Privileged domain logic lives in the **database**, not in Server Actions | Every user-uncontrollable transition is a `SECURITY DEFINER` function; Server Actions are thin forwarders. **Corollary: SECURITY DEFINER bypasses RLS, so every such function asserts its own authorisation as its first act** — ownership vs `auth.uid()` or `app.has_perm()`. That assertion IS the boundary; a function added without one is a hole |
| **D-12** | **NEW (Session 002).** BR-05's evaluation half is an **A2 attestation**; there is no evaluations entity | Step 1 §3 = "marked passed by A2"; Step 2 §B.1 = "Domain service", not a table. M4's assessment tables bind to `applications`, not `enrollments`. `mark_enrollment_completed` takes an explicit boolean; `false` fails the rule exactly as short attendance does. **Do not add an evaluations table without a new D- decision** |
| **D-13** | **NEW (Session 002).** **Row scoping is not column scoping** | A table holding columns its row-owner must not write gets a **column-level GRANT** or an **RPC-only write path**. Learned from two real flaws: `attempt_answers.awarded_score` (self-grading) and `users.email` (contributor credits) |
| **D-14** | **NEW (Session 002).** Lock order is **cohort → application**, always | `respond_to_offer` originally inverted it against the seat allocator — a deadlock under concurrent load. Any future function touching both tables must use this order |
| **D-15** | **NEW (Session 002).** A question used by an `ACTIVE`/`LOCKED` test is **frozen** | Editing it would silently rewrite a live exam and invalidate graded attempts. Trigger refuses; `clone_question_as_new_version()` is the sanctioned route |

### Residual risks (from Part D.3)
| # | Risk | Status |
|---|---|---|
| RR-1 | Seat allocation + stock reservation are concurrency-sensitive | **Open** — needs serializable txn / row locks in the service layer |
| RR-2 | `CK_CERT_CLEARANCE_APPROVED` needs more than a plain FK | **Closed by D-09** |
| RR-3 | Consumables and the return obligation | **Closed** — club confirmed 2026-08-25: consumables (`is_consumable = true`) are **excluded** from BR-01 |
| RR-4 | Certificate document immutability | **Open** — versioned private bucket + content hash on `media_assets` |
| RR-5 | Arabic full-text search quality | **Open** — evaluate PG text search config for Arabic |

---

## 4. Business Rules (BR-01 … BR-13)

| ID | Rule | Where it is enforced in `schema.sql` |
|---|---|---|
| BR-01 | Certificate requires an **APPROVED clearance for that enrollment** | `fk_cert_clearance_approved` composite FK + `ck_cert_clearance_approved` |
| BR-02 | Offer requires score ≥ pass threshold when screening required | `screening_tests.pass_threshold` + domain service |
| BR-03 | Seats in descending readiness order; overflow → ranked waitlist | `applications.rank_position` / `waitlist_rank` + transactional service |
| BR-04 | Unconfirmed offers expire; top waitlist auto-promoted | `cohorts.offer_confirmation_hours`, `applications.offer_expires_at`, S1 job |
| BR-05 | Completion = attendance ≥ min AND all evaluations passed | `cohorts.min_attendance_pct`, `v_enrollment_attendance`, `completion_overridden` |
| BR-06 | Damaged/Lost check-in opens a liability that must terminate | `liability_records` + `ck_liability_waiver_actor` |
| BR-07 | One ACTIVE checkout per serialized unit | `uq_checkout_active_unit` partial unique index |
| BR-08 | Consultations triaged within SLA; breach escalates | `consultation_requests.sla_due_at` / `sla_breached`, S1 job |
| BR-09 | Every permission-bearing action authorised + audited | `permissions`/`role_permissions`/`user_roles`, append-only `audit_logs` |
| BR-10 | Certificates carry a unique non-guessable verification code | `certificates.verification_code` UNIQUE, 128-bit random |
| BR-11 | Public entities need an explicit publish transition | `publication_status` + RLS `public_read_published_*` policies |
| BR-12 | Custody needs active enrollment or approved requisition | `ck_req_single_context`, `ck_checkout_context` |
| BR-13 | Unresolved liability blocks **new checkouts** anywhere; only *advises* on other enrollments' clearance. **Never** blocks another enrollment's certificate | `v_holder_open_liabilities` + `clearance_records.advisory_outstanding_elsewhere` |

### The BR-01 clearance gate — decision table (B.2)
`approval_enabled = C1 ∧ C2 ∧ C3 ∧ C4 ∧ C5`

| # | Condition | Failure code shown to student |
|---|---|---|
| C1 | Enrollment status = `COMPLETED` | `NOT_COMPLETED` |
| C2 | No checkout line `ACTIVE`/`OVERDUE` for this enrollment | `ITEMS_OUTSTANDING` |
| C3 | Every returned line has `condition_at_return` | `INSPECTION_PENDING` |
| C4 | No non-terminal `liability_record` for this enrollment | `LIABILITY_OPEN` |
| C5 | No `asset_incident` still `OPEN` | `INCIDENT_OPEN` |
| A1 | *(advisory)* open liabilities elsewhere | **not shown to student**; A3/A7 see `OUTSTANDING_ELSEWHERE` |

**A1 is deliberately excluded from the conjunction (D-04 Option C). Do not add it.**
**C2/C3 filter out `asset_types.is_consumable = true` (RR-3).** The single source of that
truth is the view `v_enrollment_outstanding_items`.

---

## 5. Data Model — 78 entities

| Module | Count | Tables |
|---|---|---|
| M10 Identity/RBAC/Audit | 13 | users, student_profiles, member_profiles, universities, departments, roles, permissions, role_permissions, user_roles, audit_logs, system_policies, notification_templates, notifications |
| M3 Courses & Admissions | 10 | courses, course_modules, course_module_materials, cohorts, cohort_sessions, applications, application_status_history, rejection_reasons, enrollments, attendance_records |
| M4 Assessment | 11 | topics, questions, question_options, question_topics, screening_tests, test_questions, test_attempts, attempt_answers, readiness_models, readiness_factors, application_score_factors |
| M5 Hardware Logistics | 14 | asset_categories, asset_types, storage_locations, asset_units, bulk_stock, kit_templates, kit_template_items, requisitions, requisition_lines, stock_reservations, checkouts, checkout_lines, asset_incidents, liability_records |
| M6 Clearance & Certification | 4 | clearance_records, clearance_blockers, certificates, certificate_verifications |
| M2 Consultations | 7 | expertise_domains, member_expertise, consultation_requests, consultation_request_domains, consultation_assignments, consultation_messages, consultation_attachments |
| M7 Projects | 6 | projects, project_members, technologies, project_technologies, project_bom_lines, project_media |
| M8 Events | 4 | venues, events, event_sessions, event_registrations |
| M9 Media | 9 | media_assets, article_categories, articles, tags, article_tags, galleries, gallery_items, awards, award_recipients |

### Conventions (§C.1 — do not deviate)
- Surrogate `uuid` PK everywhere; natural keys are separate UNIQUE constraints.
- `created_at` / `updated_at` `timestamptz` (UTC) on every mutable entity.
- **No soft delete.** Lifecycle is explicit status enums so transitions stay auditable.
- Runtime-editable reference lists are **tables** (rejection_reasons, expertise_domains,
  technologies, categories). Closed vocabularies are **enums**.
- Derived values are **views**, never columns. The 6 mandated views live in §14 of `schema.sql`,
  plus `v_enrollment_outstanding_items` added for RR-3.
- Money: `numeric(12,2)` + `currency_code char(3)`. Default `SYP`.
- **Multilingual:** short display fields carry `_ar`/`_en`. Long-form content (`articles`) uses
  **row-per-locale** with `translation_group_id`.

### Justified denormalisation — only these three
1. `applications.readiness_score` / `test_attempts.normalized_score` — authored decision snapshots.
2. `applications.waitlist_rank` — human-reorderable, therefore authored data.
3. `*.precondition_snapshot` / `background_snapshot` — immutable point-in-time evidence.

Everything else that looks cacheable **is a view**.

---

## 6. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js **16** (App Router, Server Components default) + React 19.2 + TypeScript |
| Backend | Supabase — Postgres + Auth + Storage + RLS |
| Auth bridge | `@supabase/ssr` (cookie-based). **Never** `@supabase/auth-helpers` — deprecated |
| Client state | Zustand 5 — theme, locale preference, UI shell **only**. Never a server-data cache |
| i18n | `next-intl` v4 — `[locale]` segment routing, ICU messages, RTL/LTR |
| Theme | `next-themes` drives the `class` on `<html>`; Zustand mirrors it for SSR-aware components |
| Styling | Tailwind CSS v4 + CSS variables for the design tokens |
| Validation | Zod v4 + react-hook-form |
| Tests | Vitest + Testing Library (unit) · Playwright (BR-01 lock + dual-language regression) |
| MCP | **Supabase MCP only** — `@supabase/mcp-server-supabase`, scoped `--project-ref`, PAT in env |

### Non-negotiables
- Supabase service-role key **never** reaches the browser. Server-only modules.
- Every DB read from a Server Component goes through the RLS-bound anon/authenticated client.
  Service-role is reserved for S1 scheduled jobs and the admin bootstrap.
- Generated DB types live in `src/lib/supabase/database.types.ts` (`npm run db:types`).

---

## 7. Internationalisation Rules

- Locales: `ar` (**default**, RTL) and `en` (LTR). Stored in `system_policies['i18n.*']`.
- Routing: `/[locale]/...`. `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`.
- Toggle: one click, preserves the current route and query string. Persists to
  (a) the `users.locale` column when authenticated, (b) a cookie + Zustand otherwise.
- **Logical CSS properties only** — `ms-*`/`me-*`/`ps-*`/`pe-*`, `start`/`end`.
  A hard-coded `ml-4` or `text-left` is an RTL bug.
- DB bilingual reads: pick `name_ar` vs `name_en` by active locale; for `articles`, query by
  `translation_group_id` + `locale`, and fall back to the other locale if that row is absent.
- Numerals: Western digits in both locales (engineering context). Dates via `date-fns` with the
  matching locale, timezone `Asia/Damascus`.

---

## 8. Visual Identity — Bold Minimalism + Tech Pixel Accent

> ⚠️ **Caveat:** `hmkVISUAL.pdf` could not be machine-read in Session 001 (no PDF tooling on
> this machine). The values below come from the club brief. **Confirm against the PDF before
> the design system is frozen.**

**Typography**
- `Madani` — primary. All UI text, forms, tables, body. Optimised for Arabic readability.
- `Minecraft PE` / `Mine Crafter` — accent only. Big header numerals, tech-themed flourishes.
  **Never** for body copy, never for Arabic.
- Font files: `D:\HMK Robotics club\Hmk robotic fonts\` (`Madani.zip`, `minecraft_pe`, `minecrafter`).
  Self-host via `next/font/local`.

**Colour tokens**
| Token | Value | Use |
|---|---|---|
| `--hmk-red` | `#E31E24` | CTAs, active states, highlights. Sparingly — it is an accent, not a background |
| `--hmk-charcoal` | Dark slate / charcoal | Dark-mode surface |
| `--hmk-white` / `--hmk-black` | Pure | Text contrast |
| `--hmk-gray` | Technical gray | Borders, dividers, muted text |

**UI rules**
- Cards: minimal corner radius, flat surfaces, clear borders. No heavy shadows.
- **Binary Code Bars** (`010101…`) as decorative header/footer dividers — the signature motif.
  Must be `aria-hidden="true"`; they are decoration, never content.
- Contrast: WCAG AA minimum. `#E31E24` on charcoal needs checking for small text — prefer it
  as a fill with white text rather than as red text on dark.

---

## 9. Google Maps — Club Location

Not an entity. Stored as config in `system_policies` under key `club.location`:

- **AR:** دمشق - طريق المطار - كلية الهندسة الميكانيكية والكهربائية (همك) - البناء الأحمر - قاعة المطالعة
- **EN:** Damascus – Airport Road – Faculty of Mechanical & Electrical Engineering (HMK) – The Red Building – Reading Hall
- **Link:** https://maps.app.goo.gl/1tc3fxDkdtTkk4KKA
- `lat` / `lng` are **null** until the club confirms the exact pin. Until then the component
  renders the deep link, not an embedded iframe with guessed coordinates.
- Embed must be responsive, lazy-loaded, and carry a descriptive `title` in the active locale.

---

## 10. Repository Layout (target)

```
E:\Full Stack X AI\Final Project\
├─ claude.md                     ← this file
├─ package.json
├─ journals\                     ← one entry per session
├─ docs\                         ← generated design docs
├─ supabase\
│  ├─ schema.sql                 ← 78 tables, constraints, views, RLS, seed
│  └─ migrations\                ← generated once MCP is connected
├─ .claude\commands\             ← /start-session, /end-session
└─ src\
   ├─ app\[locale]\              ← App Router, locale-segmented
   ├─ components\
   ├─ lib\supabase\              ← server.ts, client.ts, database.types.ts
   ├─ stores\                    ← zustand
   ├─ messages\                  ← ar.json, en.json
   └─ styles\
```

---

## 11. Multi-Persona Protocol

Work cycles through five personas; each hands off explicitly.

1. **Planner** — breaks the feature down, names the UC/US/BR it satisfies, sets the sequence.
2. **UI/UX Specialist** — applies §8, checks RTL mirroring and WCAG AA before any markup.
3. **Implementer** — writes the Next.js 16 / Supabase code. Server Components by default.
4. **Reviewer** — audits RLS coverage, secret leakage, i18n completeness, Next.js practice.
5. **Verifier** — runs `npm run verify`. **On failure, loops back to Implementer.** Never
   reports "done" on unrun tests.

---

## 12. Custom Commands

- **`/start-session`** — read `claude.md` + the newest file in `journals/`, summarise where we
  left off, then ask for the session goal.
- **`/end-session`** — write a journal entry (what shipped, decisions, open items, next steps),
  update this file, propose the next session's goal.

---

## 13. Current Status

**Last updated: end of Session 002 (2026-08-26).** Journal: `journals/2026-08-26-session-002.md`

### Live system
| Artifact | Status |
|---|---|
| Supabase project | `hgzuiowjxjmyelelzybn` — "Hamak AI & Robotics Club", us-west-2, PG 17.6.1, ACTIVE_HEALTHY |
| `supabase/schema.sql` | ✅ **Applied.** In-DB: **78 tables / 7 views / 55 enums / 380 policies / 36 functions / 0 tables without RLS** |
| Entity reconciliation | ✅ `grep -c '^create table public\.'` = 78 = live count = §5. **Data model unchanged since freeze** |
| Migrations | 15 files on disk, 20 tracked in `supabase_migrations` |
| Scheduler | ✅ `pg_cron` job `hmk-br04-expire-offers`, every 15 min, active |
| Storage buckets | ✅ `media` (public), `certificates` (private, **no policy** — RR-4), `evidence` (private) |
| Admin | ✅ `malek.shammout@gmail.com` — MEMBER/ACTIVE, ADMIN granted |
| Demo data | ✅ **None.** 1 user, 0 courses, 0 applications |
| Auth policy | min length 8, requires lower+upper+digits, reauth required on password change. **HIBP unavailable — Pro plan only (HTTP 402)** |
| Version control | ✅ git on `main` — `5a02a63` initial, `e5518fb` LMS. **No remote** |
| Supabase MCP | ✅ Registered and working |

### Modules built
| Module | State |
|---|---|
| M1 Public Portal | ✅ courses / projects / events / news (list + detail), BR-10 verification, club map |
| M10 Identity | ✅ sign-in, register, email callback, sign-out, RBAC, session header |
| M3 Admissions | ✅ A1 apply/offer/withdraw · A2 funnel, BR-02 gate, BR-03 allocation, BR-04 job |
| M3 LMS delivery | ✅ sessions, attendance register, BR-05 completion, student progress |
| M4 Assessment | ✅ attempts, auto-grading, question bank + versioning, manual grading, readiness scoring |
| M2 Consultations | ⛔ not started |
| **M5 Hardware Custody** | ⛔ **not started — blocks M6 entirely** |
| M6 Clearance & Certification | ⛔ blocked on M5 (BR-01 C2–C5 read M5 tables) |
| M7 / M8 / M9 authoring | ⛔ public read only; no staff authoring UI |

### Verification status — honest
| Check | Status |
|---|---|
| BR-01, BR-02, BR-03, BR-04, BR-05, M4 assessment + grading | ✅ **Adversarially tested** against the live DB, each rolled back |
| `tsc --noEmit` · `next build` | ✅ exit 0 · 26 route files |
| Public pages, both locales, RTL/LTR, toggles | ✅ verified in a real browser |
| Route guards signed-out | ✅ verified |
| **Signed-in flows in a browser** | ❌ **NOT verified** — needs credentials tooling should not hold |
| **Automated test suite** | ❌ **Does not exist.** Probes were run once and rolled back, not committed |

> **Largest gap: there is no regression net.** Every rule above was proven by a hand-written
> SQL probe run once. Committing those probes as a repeatable suite is the highest-value
> next task after M5.

### Immediate next steps
1. **M5 hardware custody** — audit its RLS *before* writing code (three of four flaws this
   session were found that way), then `issue_checkout` / `check_in_line` / `resolve_liability`,
   verified adversarially, then the A3 desk UI.
2. **Then M6** — clearance C1–C5 + certificate issuance, finally buildable.
3. Commit the verification probes as a real test suite.
4. Read `hmkVISUAL.pdf` and confirm the §8 palette (tokens remain **provisional**).
5. Add a git remote — history is local-only.

### Open questions for the club
- Exact lat/lng for the club pin *(still open)*.
- Confirm `#E31E24` + charcoal/gray against `hmkVISUAL.pdf` *(still open — no PDF tooling here)*.
- Currency default — schema assumes `SYP` *(still open)*.
- **NEW:** upgrade to Supabase Pro to enable leaked-password protection?
- **NEW (D-12):** is an evaluations entity ever wanted? Today BR-05's evaluation half is an
  A2 attestation with no structural record of *which* evaluations were passed.
- **NEW:** should `project_bom_lines` stay staff-only? Excluded from public read because a
  bill of materials exposes hardware holdings and unit costs.

---

## 14. Change Log

| Date | Change |
|---|---|
| 2026-08-25 | RR-3 confirmed by club: consumables excluded from BR-01 return obligation |
| 2026-08-26 | D-09 added — BR-01 lock made declarative via composite FK (closes RR-2) |
| 2026-08-26 | D-10 added — Supabase Auth owns credentials; `password_hash` dropped from `users` |
| 2026-08-26 | `v_enrollment_outstanding_items` added as the single source of RR-3 filtering |
| 2026-08-26 | Seed section moved **before** RLS enforcement in `schema.sql` (FORCE RLS would have denied the seed INSERTs) |
| 2026-08-26 | **Constraint audit found a gap.** `CK_LINE_SERIALIZATION` was missing — added as trigger `trg_line_serialization` (cross-table, so it cannot be a CHECK). `uq_cert_enrollment` / `uq_clearance_enrollment` existed as inline anonymous UNIQUEs; now explicitly named to match §C.11. All 19 constraints re-verified. |
| 2026-08-26 | `set search_path = public, extensions, pg_catalog` added at the top of `schema.sql` so the GiST opclasses for `EX_SESSION_ROOM_OVERLAP` resolve at DDL time |
| 2026-08-26 | **`schema.sql` applied to the live Supabase project** (`hgzuiowjxjmyelelzybn`, PG 17.6.1). Applied cleanly on the first attempt — no parser rejections. Verified in-DB: 78 tables / 7 views / 55 enums / 370 policies / 0 tables without RLS / seed intact (6 departments, 7 roles, 70 permissions, 165 grants) |
| 2026-08-26 | **BR-01 verified by adversarial probe against the live database**, not by inspection. Blocked: (1) certificate against an `EVALUATING` clearance, (2) forged `clearance_status` defeating the composite FK, (3) revoking a clearance while a certificate references it. Legitimate issuance succeeded. Probe rolled back — 0 rows persisted |
| 2026-08-26 | Migration 0002 applied: `auth.users`→`public.users` bridge triggers + 3 Storage buckets (`media` public, `certificates`/`evidence` private). `certificates` has **no** storage policy by design (RR-4) |
| 2026-08-26 | Admin bootstrap split into `_0003_bootstrap_admin.RUN_YOURSELF.sql` — it creates an auth identity, which is account creation and must be run by a human. Sets no password |
| 2026-08-26 | **Runtime bug found by loading the page, not by reading SQL.** `system_policies` had only an admin RLS policy, so anon reads of `club.location` returned zero rows and `ClubMap` silently rendered nothing. Migration 0004 adds `public_read_public_config` — an explicit **key allow-list**, not `using (true)`. Operational keys (SLA, loan horizon) remain staff-only; verified by querying as `anon` |
| 2026-08-26 | Next 16 deprecates the `middleware` convention → migrated to `src/proxy.ts` via the official codemod; helper renamed `lib/supabase/session.ts` |
| 2026-08-26 | Madani + Minecraft PE extracted from the club archives into `src/fonts/`, self-hosted via `next/font/local` — confirmed loading at runtime (`font-family: madani`) |
| 2026-08-26 | **M1 public portal built** — courses/projects/events/news (list + detail) and BR-10 certificate verification. 11 routes, typecheck + build clean, verified in a real browser in both locales |
| 2026-08-26 | Migration 0005 — `verify_certificate()` SECURITY DEFINER RPC. BR-10 requires unauthenticated resolution, but `users`/`enrollments`/`cohorts` must stay closed; a fixed narrow projection is the only thing that escapes. **The advisor flags this as anon-executable — that is intentional, do not "fix" it** |
| 2026-08-26 | **Migration 0006 — RLS gap found by querying `pg_policies` before writing the pages.** schema.sql opened the published PARENTS but not their child tables, so a published project would have rendered with no technologies, team or media. Children now inherit the parent's publication status. `project_bom_lines` deliberately excluded (exposes hardware holdings + costs) |
| 2026-08-26 | **Migration 0007 — second runtime bug: team member rendered as "Not available".** `users` has no anon policy (correctly). Fixed with TWO locks: a row policy limiting anon to people credited on published content, plus a **column-level grant** of only `(id, full_name_ar, full_name_en)`. Verified as `anon`: name readable, `email` refused with SQLSTATE 42501. Both locks required |
| 2026-08-26 | Migration 0008 — pinned `search_path` on 8 app-schema trigger functions (Supabase advisor lint 0011). Advisor now reports 0 search_path warnings |
| 2026-08-26 | Demo content was seeded to verify the pages against real rows, then **fully removed**. DB back to 0 courses/projects/events/articles/certificates; only the ADMIN user remains |
| 2026-08-26 | **Leaked-password protection could NOT be enabled.** Management API returned **HTTP 402**: "available on Pro Plans and up". Project is on Free. `password_hibp_enabled` remains `false` and the advisor warning stands until the org upgrades. Also noted but **not changed** (auth config is the club's to authorise): `password_min_length = 6`, `password_required_characters = none` |
| 2026-08-26 | **Auth UI built** (M10 prerequisite for M3): `/login`, `/register`, `/register/check-email`, `/auth/callback` code exchange, sign-out. Sign-in errors are deliberately generic so the form is not an account-enumeration oracle. Registration collects `full_name_ar` + `full_name_en` — bilingual by construction (claude.md §5) |
| 2026-08-26 | **Migration 0009 — M3 admissions domain functions.** `submit_application`, `respond_to_offer`, `withdraw_application`. All SECURITY DEFINER (they write audit history + enrollments), so each asserts ownership against `auth.uid()` FIRST. Status is never chosen by the client |
| 2026-08-26 | **M3 verified by adversarial probe** (rolled back, 0 rows): user B accepting user A's offer → rejected 42501; rightful owner → ENROLLED + enrollment row; elapsed offer → refused and transitioned to EXPIRED (BR-04). `respond_to_offer` locks the cohort and re-counts seats, so concurrent acceptances cannot oversubscribe (partially addresses RR-1) |
| 2026-08-26 | RTL fix found at runtime: `fullNameEn` inherited `dir=rtl` on the Arabic register page. `Field` now takes an explicit `dir` for content-script fields; verified `fullNameAr → rtl`, `fullNameEn → ltr` |
| 2026-08-26 | **`database.types.ts` went stale twice after migrations.** Run `npm run db:types` (or regenerate via MCP) after EVERY migration that adds a function or table, or `supabase.rpc()` calls fail typecheck |
| 2026-08-26 | **Password policy applied** (authorised by the club): `password_min_length = 8`, `password_required_characters = lowercase : uppercase : digits`. Confirmed by API read-back. HIBP remains **off** — Pro-plan only, HTTP 402 |
| 2026-08-26 | `src/lib/auth/actions.ts` `passwordSchema` **mirrors the Supabase policy exactly** (8 chars + upper + lower + digit). It is NOT the enforcement point — Supabase is — it exists so users get an actionable message. **If the project policy changes, change this schema in the same commit or the two drift apart.** Register hint updated in `ar` + `en` to state the real rule. Verified at runtime: EN complexity rejection, AR length rejection, 0 accounts created |
| 2026-08-26 | **`security_update_password_require_reauthentication` enabled** (authorised). A hijacked session can no longer change an account password without re-auth. Confirmed by API read-back |
| 2026-08-26 | **Migration 0010 — BR-02 / BR-03 / BR-04.** `run_seat_allocation(cohort)` applies the screening gate then allocates seats in descending readiness order with a ranked waitlist; `expire_stale_offers()` expires elapsed offers and promotes the waitlist head. **`run_seat_allocation` is SECURITY DEFINER so it asserts `M3.APPROVE` or ADMIN explicitly** (BR-09); `expire_stale_offers` is granted to `service_role` ONLY |
| 2026-08-26 | **Deadlock risk found and fixed in already-shipped code.** `respond_to_offer` (0009) locked application→cohort while the allocator locks cohort→applications — a lock-order inversion. `respond_to_offer` rewritten to lock **cohort → application**. **Any future function touching both MUST use that order** |
| 2026-08-26 | **A2 side verified by adversarial probe** (rolled back): capacity 2, scores [90,80,70,55,none], threshold 60 → unprivileged allocation refused 42501; 55 + un-attempted REJECTED (BR-02); 90/80 OFFERED and 70 WAITLISTED (BR-03); no lower-ranked applicant jumped a higher one; forced expiry → 2 EXPIRED + waitlist head auto-promoted (BR-04) |
| 2026-08-26 | Migration 0011 — `pg_cron` job `hmk-br04-expire-offers` every 15 min. BR-04 is enforced **twice on purpose**: lazily in `respond_to_offer` (a missed cron run can never let a stale offer through) and on schedule (so seats actually free up and the waitlist moves). Neither alone suffices |
| 2026-08-26 | Migration 0012 — `public.has_permission(text)` for conditional UI. Derives the subject from `auth.uid()`, takes no user param, so it cannot enumerate others' rights. **Convenience only — never an enforcement point** |
| 2026-08-26 | Staff UI: `/staff/cohorts` (funnel via `v_cohort_funnel`) and `/staff/cohorts/[code]` (ranked applicants + allocation trigger). Guarded on `M3.READ`; the allocate button additionally on `M3.APPROVE`. Typecheck caught an ambiguous PostgREST embed — `applications` has TWO FKs to `users`, so the hint `users!applicant_user_id` is required |
| 2026-08-26 | **🔴 EXPLOITABLE VULNERABILITY FOUND AND FIXED — student self-grading.** Policy `self_answer_test` on `attempt_answers` was `FOR ALL`: it scoped ROWS to the student's own in-progress attempt but placed **no restriction on COLUMNS**, so a student could `PATCH /rest/v1/attempt_answers` and set `awarded_score` directly. **Proven by live probe: a student set their own score to 999.00 and it persisted.** Since BR-02 gates admission on that score, this was a direct route to fraudulent admission. Fixed in migration 0013: students get **SELECT only**; all writes go through `save_attempt_answer()`, which touches no scoring column. **Row scoping is NOT column scoping — never restore a student write policy on `attempt_answers`** |
| 2026-08-26 | Migration 0013 — M4 assessment engine. `start_test_attempt` (deadline computed from the SERVER clock), `get_attempt_paper` (**projection excludes `is_correct`** — this RPC is the only route by which a student sees a question, which is why `questions`/`question_options` have no student read policy), `save_attempt_answer` (answer columns only), `submit_test_attempt` (auto-grades choice types; MULTI_CHOICE is all-or-nothing — partial credit needs a policy decision, not a default) |
| 2026-08-26 | Migration 0014 — `compute_readiness_score` / `compute_readiness_for_cohort` (US-TRN-06). Sources: TEST = best GRADED normalized_score; DECLARED = numeric from `background_snapshot` by factor_code, clamped 0..100 (non-numeric contributes 0 rather than poisoning the total); MANUAL = never overwritten. Writes the §C.13 **authored snapshot** + full per-factor breakdown. **Compute readiness BEFORE allocation** — BR-03 ranks on the stored score |
| 2026-08-26 | **M4 verified by adversarial probe** (rolled back, 0 rows): self-grade attempt refused; paper contains no `is_correct`; cross-user answer save refused 42501; post-deadline save → ATTEMPT_EXPIRED; attempt limit enforced; auto-grade Q1(60 right)+Q2(40 wrong) → raw 60 / normalized 60.000 / GRADED; unprivileged readiness compute refused; readiness = **66.000** (TEST 60×0.7=42 + DECLARED 80×0.3=24) with breakdown persisted |
| 2026-08-26 | Probe also caught a plain bug before it shipped: `submit_test_attempt` assigned a `text` CASE result to the `test_attempt_state` enum column. Fixed by explicit cast |
| 2026-08-26 | UI: `/me/screening/[attemptId]` (paper, per-question save, countdown, submit) + start-attempt entry on `/me/applications`; staff cohort page gained the readiness-model panel and compute button. **`AttemptCountdown` is DISPLAY ONLY** — the deadline is enforced server-side; never gate submission on it |
| 2026-08-26 | Advisor: all remaining warnings are `SECURITY DEFINER function callable by authenticated`, which is the intended design — each asserts ownership/permission internally and each assertion is adversarially verified. Plus HIBP (Pro-plan only). No RLS-disabled tables, no `search_path` regressions |
| 2026-08-26 | **Repo/DB alignment audit.** Found migration files 0009/0010/0013/0014 contained only rationale headers — **the repo could not rebuild the database**. All now carry authoritative bodies exported via `pg_get_functiondef`. Also noted: `0004` was applied via the Management API so it is NOT in `supabase_migrations` (applied but untracked), and **the project is not under version control at all** — no git repo |
| 2026-08-26 | Migration 0015 — manual grading (`grade_attempt_answer`, `finalize_attempt_grading`) + **question-bank edit integrity**. A question used by an ACTIVE/LOCKED test is now **frozen by trigger**: editing it (or flipping which option is correct) would silently change a live exam and invalidate graded attempts. The sanctioned route is `clone_question_as_new_version()` |
| 2026-08-26 | **Grading verified by adversarial probe** (rolled back): student grading own answer → 42501; score above weight → SCORE_OUT_OF_RANGE; finalise with ungraded → UNGRADED_ANSWERS_REMAIN; **unjustified amendment → OVERRIDE_REASON_REQUIRED**; justified amendment preserved `original_score=45`; finalise → 90.000; live question edit and answer-key flip both → QUESTION_IS_LIVE; version clone → v2 with options, v1 no longer current |
| 2026-08-26 | Two more bugs caught pre-ship: (a) `grade_attempt_answer` set `is_override` without `override_reason`, violating CK_ANSWER_OVERRIDE_JUSTIFIED — **the constraint was right**, the function now requires a justification; (b) `assert_question_not_live` used a CASE referencing both `NEW.id` and `NEW.question_id` — PL/pgSQL plans the whole expression, so every UPDATE on `questions` failed. Rewritten with IF branches |
| 2026-08-26 | M4 UI complete: `/staff/questions` (bank + frozen indicator + new-version), `/staff/questions/new` (authoring; **`auto_gradable` is DERIVED from type, never taken from the form** — a SHORT_ANSWER marked auto-gradable would score 0 forever), `/staff/grading` (queue), `/staff/grading/[attemptId]` (rubric, answer, grade, amend, finalise). 23 routes, typecheck clean, build exit 0 |
| 2026-08-26 | **Version control established.** `git init` on `main`, `.gitattributes` with `eol=lf`, initial commit `5a02a63` — 117 files. Verified excluded: `.env.local`, `node_modules/`, `.next/`, `*.tsbuildinfo`. No PAT anywhere tracked; the one `eyJ…` hit in `package-lock.json` was checked and is a coincidental base64 hash, not a JWT |
| 2026-08-26 | **Module-label mismatch resolved with the club.** "M2/M5 = LMS and Certificate Issuance" did not match the frozen map (M2=Consultations, M5=Hardware Logistics, **M6**=Certification). Club chose **LMS delivery (M3 completion side)**. Note for later: **certificate issuance (M6) cannot be built before M5** — BR-01's C2–C5 read `checkout_lines` / `liability_records` / `asset_incidents` directly |
| 2026-08-26 | **BR-05 has no evaluations entity — by design, confirmed in both frozen docs.** Step 1 §3 says evaluations are "marked passed by A2"; Step 2 §B.1 lists the enforcement layer as "Domain service", not a table. M4's assessment tables bind to `applications` (screening), not `enrollments`. So migration 0016 computes the **attendance** half and takes the **evaluations** half as an explicit A2 attestation boolean. **Do not add an evaluations table without a recorded D- decision** |
| 2026-08-26 | Migration 0016 — `record_attendance`, `evaluate_completion_readiness`, `mark_enrollment_completed`. Only `HELD` sessions count (cancelled sessions never penalise a student); PRESENT/LATE/EXCUSED all count as attended. Completion opens `clearance_records` in `EVALUATING`, starting the M6 pipeline per the §B.13 state machine — it grants nothing, BR-01 still requires an APPROVED clearance |
| 2026-08-26 | **LMS verified by adversarial probe** (rolled back): student recording own attendance → 42501; cross-cohort mark → SESSION_COHORT_MISMATCH; unjustified amendment → AMENDMENT_REASON_REQUIRED; CANCELLED excluded from denominator; 33.33% correctly fails a 75% minimum; short attendance → BR05_NOT_SATISFIED; **missing evaluation attestation → BR05_NOT_SATISFIED**; both halves → COMPLETED; A7 override → COMPLETED_BY_OVERRIDE + audit row; clearance opened EVALUATING |
| 2026-08-26 | LMS UI: `/staff/cohorts/[code]/sessions`, `/staff/sessions/[sessionId]` (register), `/staff/cohorts/[code]/completion`, `/me/enrollments` (attendance progress bar). 27 routes, typecheck clean, build exit 0 |
| 2026-08-26 | **Session 002 closed.** Journal `journals/2026-08-26-session-002.md`. Five new decisions ratified: **D-11** (privileged domain logic lives in the database; SECURITY DEFINER bypasses RLS so every such function asserts its own authorisation), **D-12** (BR-05's evaluation half is an A2 attestation — no evaluations entity), **D-13** (row scoping is not column scoping), **D-14** (lock order cohort → application), **D-15** (live questions frozen; changes go through versioning) |
| 2026-08-26 | Session 002 verification summary: BR-01/02/03/04/05, M3 offer transitions, M4 assessment, M4 manual grading + versioning — **all adversarially tested against the live DB and rolled back**. Typecheck + build exit 0, 26 route files. **Not verified: signed-in flows in a browser; no automated test suite exists** |
| 2026-08-26 | Entity count re-reconciled at session close: `grep -c '^create table public\.' supabase/schema.sql` = **78** = live base-table count = §5. **The data model has not changed since the freeze** |
| 2026-08-26 | **Database test suite created.** `supabase/tests/` + `scripts/run-db-tests.mjs`, wired into `npm run test:db` and `npm run verify`. Each test is a self-contained adversarial probe ending in `raise exception 'ALL_..._PASSED'`, which aborts the transaction — **a test never persists a row**. The runner treats any other outcome as failure, **including a test that returns cleanly** (its final assertion never ran). It caught real drift on the first run: test 01 predated the 0002 auth bridge |
| 2026-08-26 | **🔴 GAP FOUND AND PROVEN — BR-06's A7-only waiver was enforced nowhere.** `ck_liability_waiver_actor` only requires that SOMEONE is named; a CHECK cannot see roles. `staff_update` granted UPDATE to anyone with M5.UPDATE. **A LOGISTICS member waived a 250 SYP liability naming themselves, and it persisted.** D-13 for the third time. Fixed in migration 0017: `checkouts` / `checkout_lines` / `liability_records` are **RPC-write-only**; `resolve_liability` asserts admin for the waiver path. **Do not restore staff_update on liability_records** |
| 2026-08-26 | Migration 0017 — M5 custody domain: `issue_checkout` (BR-12 context, BR-13 liability block, BR-07 single active unit), `check_in_line` (BR-06 opens a liability valued from `unit_cost`, `CK_RETURN_INSPECTED`), `resolve_liability` (A7-only waiver). Also fixed an API fault the typechecker exposed: `issue_checkout` required BOTH context params though BR-12 makes them exclusive — signature reordered so they carry defaults |
| 2026-08-26 | A3 desk UI: `/staff/desk`, `/staff/checkouts`, `/staff/checkouts/[id]`, `/staff/liabilities`, `/staff/assets`. BR-13 warns at holder selection; BR-06 reveals the assessed-value field on Damaged/Lost; the waiver option is admin-only in the UI **as courtesy — the database is the enforcement** |
| 2026-08-26 | **Migration 0018 — M6 clearance & certificate issuance.** §B.2 implemented literally: `approval_enabled = C1 ∧ C2 ∧ C3 ∧ C4 ∧ C5`. **A1 is recorded as advisory and marked `blocking:false`; it must NEVER enter the conjunction** (D-04 Option C). C2/C3 read `v_enrollment_outstanding_items` so RR-3 consumables are excluded in exactly one place. `issue_certificate` writes `clearance_status` from the **locked** clearance row, so the D-09 composite FK cannot be circumvented |
| 2026-08-26 | **Full student lifecycle verified end to end** (test 08, rolled back): enrol → attend → complete → borrow → damage → liability → resolve → inspect → clearance → certificate → public verification. Asserts C1 blocks issuance, RR-3 consumables never block C2, **A1 fires as advisory but C4 ignores it**, BR-10 code is 128-bit, second issuance refused, and revoking a clearance under a live certificate raises `foreign_key_violation` |
| 2026-08-26 | M6 UI: `/staff/clearance`, `/staff/clearance/[enrollmentId]` (B.2 table, blockers, approve, issue), `/me/certificates`. **The student view omits the A1 advisory entirely** — §B.2 says it is not shown to students, and it concerns other enrollments |
