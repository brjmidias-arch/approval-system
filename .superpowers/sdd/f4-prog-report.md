# Fase 4 — Programação: client-direct posts

**Status**: done
**Commit**: 71877d0 — feat(fase4): programacao includes client-direct posts (grouped by client)
**tsc + build**: `npx tsc --noEmit` → 0 errors; `npm run build` → succeeded (prisma generate + next build, `/admin/programacao` compiled at 3.47 kB / 120 kB First Load JS).

## Concerns

- The query filters `postedAt: null` at the DB level (per spec), so every fetched post is inherently unposted. Consequence: the "Concluídos" tab (`doneCampaigns`, built from `posts.every(p => p.postedAt)`) will now always be empty — it can no longer surface clients whose posts were already marked posted, since posted items never enter the result set. This matches the literal query given in the task; flagging in case the intended behavior was to keep "Concluídos" populated for client-direct posts.
- `ProgPostRow` (in `ProgramacaoKanban.tsx`, unchanged) calls `PATCH /api/admin/campaigns/${post.campaignId}/items/${post.id}` to mark a post as posted. Since `campaignId` is now set to `client.id` for client-direct posts, this hits `/api/admin/campaigns/[id]/items/[itemId]` with a client id in the `[id]` slot. The single-item `postedAt` update still works (it updates by `itemId` alone), but the carousel-sibling cascade (`updateMany({ where: { campaignId: params.id, groupId, ... } })`) and the campaign-auto-publish check both filter on `contentItem.campaignId = params.id`/`campaign.update({ where: { id: params.id } })` — for client-direct items `contentItem.campaignId` is actually `null`, so those side effects silently no-op instead of erroring (verified no exception path is hit). Net effect: marking a client-direct carousel post as posted will only flip the clicked slide, not its siblings. This is a pre-existing gap in that route for the per-client model, out of scope per task instructions (page-only change), noting it for a future phase.
- Grouping is now purely by client (one `CampaignData` per client, `campaignId`/`campaignName` both set to the client's id/name) rather than one entry per campaign — multiple legacy campaigns for the same client are merged into a single card, as instructed.

## Files touched

- `c:\Users\mfbro\OneDrive\Documentos\approval-system\src\app\admin\(protected)\programacao\page.tsx` (only file committed)
