# Fase 3.1 — Task 2 Report: PATCH/DELETE /api/admin/posts/[itemId]

## Status: DONE

## What was done

Created `src/app/api/admin/posts/[itemId]/route.ts` with the exact code specified
in Task 2, Step 1 of `docs/superpowers/plans/2026-07-22-fase3-1-admin-api-por-post.md`
(verbatim, no deviations):

- `postItemIds(itemId)` helper — returns all ids in the carousel group
  (`contentType === "CARROSSEL"` with `groupId`) or just the single item id
  otherwise. Used to propagate updates/transitions across carousel slides.
- `PATCH` handler:
  - Auth-gated: 401 `{ error: "Não autorizado" }` if no session.
  - 404 `{ error: "Post não encontrado" }` if `params.itemId` doesn't exist.
  - Field edits on the clicked item only: `title`, `caption`, `scheduledDate`,
    `driveUrl`, `coverUrl`, `coverDriveUrl`, `fileUrl`, `fileType`.
  - `scheduledDate` and `sentToProgramacao` propagate to the whole
    carousel group via `postItemIds`.
  - `action: "send-internal"` → sets group status to `INTERNAL_REVIEW`,
    upserts `InternalReviewItem` (PENDING, cleared comment/reviewedAt) per
    item — **no `campaignId`** (nullable now, per re-architecture).
  - `action: "send-client"` → sets group status to `CLIENT_REVIEW`, clears
    `sentToProgramacaoAt`, upserts `ApprovalItem` (PENDING, cleared
    clientComment/reviewedAt) per item — no `campaignId`.
  - `action: "mark-published"` → sets group status to `PUBLISHED`, sets
    `postedAt`.
  - try/catch → 500 `{ error: "Erro ao atualizar post" }` on failure.
- `DELETE` handler:
  - Auth-gated: same 401 pattern.
  - Resolves group ids via `postItemIds`; 404 if empty (item not found).
  - Deletes the whole carousel group (or single item) via `deleteMany`.
  - try/catch → 500 `{ error: "Erro ao excluir post" }` on failure.

## Verification

- `npx tsc --noEmit` → **zero errors**.
- `npm run build` → **success**. Route table confirms both:
  - `ƒ /api/admin/clients/[id]/items`
  - `ƒ /api/admin/posts/[itemId]`
  All other routes compiled and static pages generated (20/20) without issue.

## Commit

- Staged only `src/app/api/admin/posts/[itemId]/route.ts` (verified via
  `git status --short` before commit — no other files were swept in).
- Commit: `5d29c4a` — `feat(fase3.1): PATCH/DELETE /api/admin/posts/[itemId] (edit + stage transitions)`
- First commit attempt failed with `fatal: unable to write new index file`
  (transient OneDrive file-lock issue, not a code/data problem — disk had
  111G free). Retried immediately and it succeeded cleanly with the same
  staged content.

## Concerns

None. Frontend wiring to call this new endpoint is out of scope for this
task (not requested) and was not touched.
