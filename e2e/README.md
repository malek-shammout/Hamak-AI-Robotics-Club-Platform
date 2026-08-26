# End-to-end suite

Split by what each spec needs, so that a missing credential never turns into a silent pass.

| Folder | Needs | Behaviour without it |
|---|---|---|
| `public/` | nothing | always runs |
| `auth/` | `E2E_EMAIL`, `E2E_PASSWORD` | **skips loudly**, naming what is missing |

## Running

```bash
npx playwright install chromium      # once
npm run test:e2e
```

The config builds and serves the **production** build on port 3100. Testing the dev
server would let HMR, React strict-mode double renders and unminified errors mask real
problems.

## The signed-in specs

They need a real account, and creating accounts is not something the tooling does — an
auth identity is a credential, and credentials belong to the club. Create a throwaway
member in Supabase, then:

```bash
E2E_EMAIL=someone@example.com E2E_PASSWORD='...' npm run test:e2e
```

Give that account whatever role the path under test requires. `auth/staff.spec.ts`
distinguishes "signed in but unauthorised" from "not signed in", because those must
behave differently and confusing them is a real class of bug.

## Conventions

- Assert on **roles and accessible names**, not CSS classes. A test that breaks when a
  class is renamed is noise; one that breaks when a button loses its label is signal.
- Every spec that touches layout asserts `dir` explicitly. RTL is the default locale
  here and mirroring bugs are invisible in English.
- Never assert on a hard-coded translated string where a key would do — except where the
  point IS the translation, which is what `i18n.spec.ts` exists for.
