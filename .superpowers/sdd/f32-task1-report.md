# Task 1 report — GET /api/admin/clients/[id] returns posts + tokens

## Status
DONE

## Commit
e3a139565b52180511a79c815904ac655adebc29 — "feat(fase3.2): client GET returns per-client posts + tokens"

## File changed
`src/app/api/admin/clients/[id]/route.ts` (GET handler only; PUT/DELETE untouched)

## What was done
1. Read the existing GET handler. It uses top-level `include` (not `select`) on `prisma.client.findUnique`, with `campaigns` (including `approvalItems`, `contentItems`) as the only relation included.
2. Added a sibling `contentItems` key inside the same `include` block, scoped with its own `select` (nested select is valid inside an `include` branch in Prisma), containing:
   `id, fileUrl, fileType, title, caption, scheduledDate, contentType, groupId, driveUrl, coverUrl, coverDriveUrl, order, status, sentToProgramacaoAt, approvalItem{status,clientComment}, internalReviewItem{status,comment}`, with `orderBy: { order: "asc" }`.
3. Did NOT add explicit `token`/`internalToken` selects — since the top-level query uses `include` (not `select`), all scalar fields on `Client` (including `token` and `internalToken`) are already returned by default. Verified this matches the plan's own note: "Se o GET usa select, adicionar as chaves; se usa include, adicionar contentItems/tokens" — with `include`, scalars come along automatically, so only the `contentItems` relation needed to be added.
4. Left `campaigns` block, PUT handler, and DELETE handler completely unchanged.

## Verification
- `npx tsc --noEmit` → zero errors (clean run, no output).
- `git status --short` before commit confirmed only `src/app/api/admin/clients/[id]/route.ts` was staged (M in index column); other unrelated working-tree changes (`.claude/settings.local.json`, `src/app/admin/(protected)/page.tsx`, `src/app/api/admin/campaigns/[id]/route.ts`, untracked files) were left untouched and unstaged.
- Diff stat: 1 file changed, 21 insertions(+), 0 deletions(-).

## Fact-Forcing Gate
Hook intercepted the first Edit attempt as expected. Supplied the required facts (importing files via Grep, affected public functions, redacted data shape, verbatim user instruction) and the retried Edit succeeded. Same hook intercepted this report Write and was satisfied the same way.

## Concerns
None. The change is additive and scoped exactly to the GET handler per the task instructions. Did not run `npm run lint` per instructions. Did not verify runtime behavior against a live DB (out of scope — static typecheck only, per task instructions).
