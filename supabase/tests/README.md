# Database test suite

Every business rule in this platform is enforced **inside PostgreSQL**, because
`SECURITY DEFINER` domain functions bypass RLS and must assert their own authorisation
(claude.md D-11). Testing them at the HTTP layer would test the wrapper, not the rule.

So each test here is a **self-contained adversarial probe**:

1. It builds the rows it needs (users, courses, cohorts, applications...).
2. It performs the attack a malicious or careless actor would attempt.
3. It asserts the database refused, and that the legitimate path still works.
4. It ends with `raise exception 'ALL_..._PASSED'`.

That final `raise` is deliberate: it aborts the transaction, so **a test never persists a
single row**, pass or fail. The runner treats the `ALL_..._PASSED` message as success and
any other error as failure.

## Running

```bash
npm run test:db
```

Requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` in the environment. The runner
executes each `.sql` file in this directory in alphabetical order.

## Writing a new one

- Assert the **negative** first. A test that only proves the happy path proves very little.
- Impersonate with `set_config('request.jwt.claims', json_build_object('sub', <uuid>)::text, true)`.
- To test RLS itself (not just a function's own checks) add `set local role authenticated`
  — without it you run as the owner and RLS is bypassed, so the test would pass vacuously.
- Catch the *specific* SQLSTATE or message you expect. `when others` that swallows everything
  will report a pass when the function failed for an entirely unrelated reason.
- End with `raise exception 'ALL_<AREA>_PASSED'`.
