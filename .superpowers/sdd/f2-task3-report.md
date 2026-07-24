# Fase 2 — Task 3 Report: API de revisão interna (GET+PATCH por cliente, redirect legado)

## Status: DONE

## Scope
Rewrote `src/app/api/internal/[token]/route.ts` per plan section "## Task 3: API de revisão interna (GET+PATCH por cliente, redirect legado)" in `docs/superpowers/plans/2026-07-22-fase2-links-publicos.md` — verbatim code from the plan, no deviations.

## Changes
- **GET**: Resolves token as `Client.internalToken` first (new evergreen mode) → returns posts with `status: "INTERNAL_REVIEW"` for that client, shaped as `{ id, name, token, internalToken, status:"INTERNAL_REVIEW", client:{name}, contentItems }`. Falls back to `Campaign.internalToken` (legacy) → returns `{ redirect: <client.internalToken> }`. Else 404 `{ error: "Link não encontrado" }`.
- **PATCH**: Resolves client by `internalToken`; 404 if not found. Validates `contentItemId`/`status` (must be one of `APPROVED|ADJUSTMENT|REJECTED`). IDOR guard: `contentItem` must belong to `client.id` (404 otherwise). Upserts `InternalReviewItem` (no `campaignId` in `create` — relies on prerequisite nullable schema field, already done per task instructions). Sets `ContentItem.status` to `INTERNAL_DONE` if approved, else `INTERNAL_REVIEW`. No auto-close/auto-transition of campaign (removed from old implementation).

## Removed
- Old campaign-centric GET (selected full campaign with all `contentItems`, no status filter).
- Old PATCH's auto-transition logic that flipped `Campaign.status` to `INTERNAL_DONE` when all items reviewed.

## Prerequisite
Per task instructions, `InternalReviewItem.campaignId` nullable + `npx prisma generate` was already done prior to this task — not touched here.

## Verification
- `npx tsc --noEmit` → zero errors (no output, clean exit).
- Did NOT run `npm run lint` (per instructions).

## Commit
- Hash: `94a69f1`
- Message: `feat(fase2): client-internalToken review API (per-post status) + legacy redirect`
- Files: only `src/app/api/internal/[token]/route.ts` (1 file changed, 39 insertions, 77 deletions). Confirmed no stray files staged (`git add "src/app/api/internal/[token]/route.ts"` explicitly, not `git add .`).

## Concerns
None. Code matches the plan's given block exactly; typecheck clean; commit scoped correctly. Note there were pre-existing unstaged/untracked changes in the working tree (`.claude/settings.local.json`, `src/app/admin/(protected)/page.tsx`, `src/app/api/admin/campaigns/[id]/route.ts`, `.claude/checkpoints.log`, `.claude/settings.json`, `.superpowers/`, `drive-preview-demo.html`) from outside this task's scope — left untouched as instructed.
