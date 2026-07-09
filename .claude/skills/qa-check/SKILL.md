---
description: QA review of new features and fixes on the marc (staging) branch before promoting to main (prod). Checks code correctness, branch alignment, and deploy readiness. Use whenever Marc says he made changes and wants them verified.
allowed-tools: Read, Grep, Glob, Bash
---

## What's on staging (marc) that hasn't reached prod (main) yet

Commits:
!`git log main..marc --oneline`

Changed files summary:
!`git diff main...marc --stat`

## Current branch
!`git branch --show-current`

---

## Your job as QA reviewer

You are reviewing changes made to the Redadair attendance app (Next.js App Router, Prisma, PostgreSQL, shadcn/ui, SWR). The `marc` branch is staging, `main` is prod (staff.redadair.com.au).

**Step 1 - Read the actual changed files**

Use the diff stat above to identify which files changed. Read the important ones (API routes, components, lib files) using the Read tool. Focus on files that are most likely to have bugs.

**Step 2 - Check code correctness**

For each changed file, look for:
- Missing await on async Prisma calls or fetch calls
- API routes missing auth guards (getServerSession / session check at the top)
- Unhandled edge cases (null/undefined access, empty arrays, missing error handling at API boundaries)
- React hooks rules violations (hooks inside conditions, missing deps in useEffect)
- SWR mutation calls that do not revalidate the right key after a change

**Step 3 - Check app-specific patterns**

These patterns are non-obvious and have caused bugs before:
- Dual leave system: Leave model = admin-created approved leaves. LeaveRequest model = staff pending requests. Do not mix them.
- Provisional attendance: When staff submits CLOCK_IN, a provisional Attendance record is created with notes: PROVISIONAL_REQUEST:{requestId}. Check that approval/decline handlers clean this up correctly.
- Timezone dates: Always use parseISO(date.slice(0, 10)) for leave date comparisons, NOT full ISO string, to avoid UTC/local timezone mismatch.
- Amendment flow: When targetId is set on a request, it is amending an existing record. The POST handler must skip provisional record creation.

**Step 4 - Check patch notes**

Read src/lib/patch-notes.ts. If any of the changes are user-visible features (new UI, new behaviour, new data shown), the patch notes MUST be updated. If they were not updated, flag it clearly.

Rules for patch notes:
- Plain English only, no backend or technical language
- Role-filtered: audience should be admin for admin-only features
- No jargon like API, endpoint, Prisma, Cloud Run, schema

**Step 5 - Branch alignment check**

Confirm:
- New work is on marc (staging), not accidentally committed to main
- main is behind marc (prod does not have the new stuff yet, that is correct)
- No accidental merge commits or rebases that would confuse the history

---

## Output format

Give your verdict clearly at the top, then details below.

VERDICT: Ready to deploy to staging - no issues found, safe to run .\external-tools\deploy-staging.ps1 -SkipDataCopy -SkipInfrastructure

OR

VERDICT: Fix before deploying - issues found that should be addressed first

OR

VERDICT: Critical bugs - do not deploy - breaking issues found

Then list findings grouped by severity:

### Critical (must fix before staging)

### Warnings (should fix, but will not break the app)

### Patch notes gap (update src/lib/patch-notes.ts)

### All clear items
- List what was checked and confirmed correct