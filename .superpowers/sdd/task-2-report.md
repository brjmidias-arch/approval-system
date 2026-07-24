# Task 2 Report: API pública `/api/programar/[clientId]` (GET + PATCH)

> Note: this file previously held a report for an unrelated task ("PATCH de item:
> ligar/desligar sentToProgramacao + propagação + limpeza no reset" from a different
> plan, `docs/superpowers/plans/2026-07-10-enviar-post-programacao.md`). It has been
> overwritten with the report for the current task, per
> `docs/superpowers/plans/2026-07-10-link-programacao-social-media.md` Task 2.

## Status: DONE

## What was done

Created `src/app/api/programar/[clientId]/route.ts` using the exact code specified in
`docs/superpowers/plans/2026-07-10-link-programacao-social-media.md`, Task 2 / Step 1,
verbatim (no modifications).

### GET /api/programar/[clientId]
- Looks up `Client` by `id`; returns 404 `{ error: "Cliente não encontrado" }` if missing.
- Loads `Campaign`s for the client where either `status` is `CLOSED`/`PUBLISHED`, or at
  least one `ContentItem` has `sentToProgramacaoAt` set.
- Selects the fields needed by `getSchedulablePosts` (from `@/lib/programacao`, Task 1):
  `contentItems` (id, contentType, groupId, title, caption, fileUrl, fileType, coverUrl,
  coverDriveUrl, driveUrl, scheduledDate, postedAt, sentToProgramacaoAt,
  internalReviewItem.status) and `approvalItems` (contentItemId, status, reviewedAt).
- For each campaign, calls `getSchedulablePosts(c)` then filters out posts that already
  have `postedAt` set, and drops campaigns with 0 remaining posts.
- Returns `{ clientName, campaigns: [{ campaignId, campaignName, posts }] }`.

### PATCH /api/programar/[clientId]
- Body: `{ contentItemId }`; 400 `{ error: "Campo obrigatório faltando" }` if missing.
- IDOR guard: looks up the `ContentItem` with `id === contentItemId AND
  campaign.clientId === params.clientId`; 404 `{ error: "Item não encontrado" }` if not
  found (covers both nonexistent item and item belonging to a different client).
- Sets `postedAt = new Date()` on the item.
- Auto-publish check: reloads all `ContentItem`s for the campaign with their
  `approvalItem`, filters to `APPROVED` ones, and if there is at least one and all of
  them now have `postedAt` set, updates the `Campaign.status` to `PUBLISHED`.
- Returns `{ success: true }` on success, 500 `{ error: "Erro ao marcar como agendado" }`
  on unexpected failure.

## Verification

- Confirmed via `Glob` that no route already existed at `src/app/api/programar/**`
  before creation.
- Cross-checked all field names used in the Prisma query/select against
  `prisma/schema.prisma`: `Client.name`, `Campaign.clientId/status/createdAt`,
  `ContentItem.driveUrl`, `.coverDriveUrl`, `.postedAt`, `.sentToProgramacaoAt`,
  `ContentItem.approvalItem` (singular relation), `ContentItem.internalReviewItem`
  (singular relation) — all present and correctly named/typed.
- `npx tsc --noEmit` -> **zero errors** (no output).
- Did **not** run `npm run lint` per instructions (ESLint not configured in this repo).
- A local "Fact-Forcing Gate" hook intercepted both `Write` calls in this task (the
  route file and this report); supplied the requested facts inline each time
  (caller/no-duplicate confirmation via Glob, schema field dump or N/A, verbatim
  instruction quote) and each retry succeeded.

## Commit

- Staged only the target file: `git add "src/app/api/programar/[clientId]/route.ts"`
  (verified via `git status --short` that nothing else was staged — pre-existing
  unrelated modified files in the working tree were left untouched).
- Commit message: `feat: public GET/PATCH /api/programar/[clientId]`
- Commit hash: `a20ddeaee35896e716b372783dda15473128bbb8`
- Diff stat: `1 file changed, 103 insertions(+)`
- `git status --short` after commit still shows the pre-existing unrelated changes
  (`.claude/settings.local.json`, `src/app/admin/(protected)/page.tsx`,
  `src/app/api/admin/campaigns/[id]/route.ts`,
  `src/app/api/approval/[token]/route.ts`, plus untracked
  `.claude/checkpoints.log`, `.claude/settings.json`, `.superpowers/`,
  `drive-preview-demo.html`) as modified/untracked — none of these were touched or
  committed by this task.

## Concerns

None functionally. The file matches the plan verbatim, typechecks cleanly, and the
commit is scoped to exactly the one file requested. Two minor notes for the human:
1. `git commit` printed a CRLF/LF line-ending warning for the new file (Windows
   `core.autocrlf` behavior) — informational only, did not affect commit content.
2. The report path `.superpowers/sdd/task-2-report.md` is reused across at least two
   different plans in this repo (this plan and `2026-07-10-enviar-post-programacao.md`),
   causing report collisions/overwrites. Worth using plan-scoped report filenames going
   forward if both plans' histories need to be kept.
