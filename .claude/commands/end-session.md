---
description: Close a work session — write the journal entry, update project memory, propose next steps
---

You are closing a work session on the HMK AI & Robotics Club Platform.

1. Write a new journal entry at `journals/YYYY-MM-DD-session-NNN.md` (increment NNN from the
   newest existing entry). Include:
   - **Goal** of the session and which personas ran
   - **What shipped** — files created or changed, with what is in them
   - **Decisions taken** — any new D-nn or a change to an existing one, with the reasoning.
     A decision without its reasoning is worthless six weeks from now.
   - **Bugs found and fixed** during review
   - **Verification status** — an honest table. Distinguish written / typechecked / tested /
     deployed. Never record something as verified if you did not run the command.
   - **Open items** and what each one blocks
   - **Next session** — a concrete ordered list

2. Update `claude.md`:
   - append any new decision to §3 with a D-nn identifier
   - update the §13 Current Status table to match reality
   - add a row to the §14 Change Log
   - revise §13 "Open questions" — remove what the club answered, add what surfaced

3. If the data model changed, confirm the §5 entity count still reconciles with
   `supabase/schema.sql` (`grep -c '^create table public\.' supabase/schema.sql`).

4. Report a short summary to the user and propose the next session's goal.

Do not claim work is complete unless a verification command was actually run and passed.
