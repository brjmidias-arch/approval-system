# Fase 3.2 — Task 3 Report: Client workspace by status

**Status:** DONE
**Commit:** 461acb9 — `feat(fase3.2): client workspace by status (create/move posts, links)`
**File rewritten:** `src/app/admin/(protected)/clients/[id]/page.tsx`

## Verification

- `npx tsc --noEmit` → zero errors.
- `npm run build` → success. `/admin/clients/[id]` compiles at 5.03 kB First Load JS (route list confirms it alongside `/api/admin/posts/[itemId]` and `/api/admin/clients/[id]/items`, both already present from Task 1/2 of this plan).

## What was built

Full rewrite of the "campaigns list" page into the per-status post workspace described in Task 3 of `docs/superpowers/plans/2026-07-22-fase3-2-workspace-cliente.md`:

- **Header:** client name, email/whatsapp, breadcrumb to `/admin/clients`. Buttons: "+ Adicionar posts" (opens `FolderUploadModal` with `clientId={id}` and `existingItemCount={client.contentItems.length}`), "Copiar link do cliente" (`${origin}/aprovar/${client.token}`), "Copiar link revisão interna" (`${origin}/revisar/${client.internalToken}`). No "Nova Campanha" button/modal — fully removed.
- **Data:** `fetchClient()` calls `GET /api/admin/clients/[id]` (already returns `contentItems` + `token`/`internalToken` per Task 1, verified by reading the route). Auto-refreshes every 60s like the old campaign page.
- **Grouping:** `buildGroups()` groups `contentItems` by `groupId` when `contentType === "CARROSSEL" && groupId` (1 post per group, representative = first slide sorted by `order`); everything else is a single-item group. Mirrors the old `campaigns/[id]/page.tsx` grouping logic.
- **Sections:** one block per non-empty status in the exact order/labels from the spec: DRAFT→"Rascunho", INTERNAL_REVIEW→"Revisão interna", INTERNAL_DONE→"Revisão interna concluída", CLIENT_REVIEW→"Aguardando cliente", APPROVED→"Aprovado", PUBLISHED→"Publicado". Each has a heading with count.
- **Post card:** thumbnail (image/video/document icon, carousel slide-count badge), title, content-type badge, carousel badge, scheduled date, line-clamped caption, Drive link, `internalReviewItem.comment` and `approvalItem.clientComment` shown as separate comment chips, review-status badges (internal + client) when those items exist, and the per-status action row exactly as specified:
  - `DRAFT`: "Enviar p/ revisão interna" (`PATCH {action:"send-internal"}`), Editar, Excluir.
  - `INTERNAL_REVIEW`: "Ajuste feito" (`PATCH {action:"send-internal"}`) only when `internalReviewItem.status` is ADJUSTMENT/REJECTED, + Editar, Excluir.
  - `INTERNAL_DONE`: "Enviar p/ cliente" (`PATCH {action:"send-client"}`), Editar, Excluir.
  - `CLIENT_REVIEW`: "Ajuste feito" (`PATCH {action:"send-client"}`) only when `approvalItem.status` is ADJUSTMENT/REJECTED, + Editar, Excluir.
  - `APPROVED`: "→ Programação" / "Remover da Programação" toggle (`PATCH {sentToProgramacao}`) with "✓ Na Programação" seal when `sentToProgramacaoAt` is set, "Marcar publicado" (`PATCH {action:"mark-published"}`), Editar, Excluir.
  - `PUBLISHED`: "✅ Publicado" badge, Excluir only (no Editar, per spec).
  - All statuses: "🔗 Link p/ designer" copies `${origin}/post/${repId}`.
- **Edit modal:** título, legenda, data, link do Drive, capa do Drive (shown only for VIDEO/REELS) → loops `PATCH /api/admin/posts/[itemId]` over every slide in the group (mirrors the old page's per-slide loop, since the PATCH route only propagates `scheduledDate`/`sentToProgramacao` server-side, not title/caption/driveUrl/cover).
- **Delete:** `DELETE /api/admin/posts/[repId]` with a `confirm()` that mentions slide count for carousels; server resolves the whole group.
- **Per-post busy state:** single `busyId` (set to the representative id) disables that card's action buttons during a request; every action calls `fetchClient()` on success/settle.
- **Loading / empty states:** "Carregando..." while loading, "Cliente não encontrado." if the fetch 404s, and an empty-state block with a shortcut to open the upload modal when the client has zero posts.
- Dark theme (`#0f0f0f`/`#1a1a1a`, `white/10` borders) and pt-BR labels throughout, consistent with the rest of the admin.

## Deviations from the literal old-page pattern (behavior-preserving)

1. **Did not reuse `CarouselCard` component.** `CarouselCard` hardcodes campaign-scoped endpoints internally (`/api/admin/campaigns/${campaignId}/items/${slideId}` for slide-replace, `/api/admin/campaigns/${campaignId}/reorder` for drag-reorder) and requires a `campaignId` prop. Client-scoped posts created via `/api/admin/clients/[id]/items` have no `campaignId`, and the 3.1 API has no reorder/replace-slide endpoint for client-scoped items. Reusing the component as-is would have produced silently-broken buttons (404s) for any client-created carousel. Instead I built a single unified card (used for both single posts and carousels) that shows a thumbnail + slide-count badge for carousels, without drag-reorder or per-slide replace — those two capabilities are simply out of scope for this task per the plan (no reorder endpoint exists in the 3.1 contract) and aren't listed in the Task 3 action-row spec.
2. **No "add slides to existing carousel" in the edit modal.** The old campaign page's edit modal had a "add slides via Drive links" textarea; Task 3's spec for the edit modal only lists título/legenda/data/link do Drive/capa, so this was omitted to stay literal to the spec and avoid inventing an unspecified endpoint interaction.
3. Kept the review-status badges data-driven off `internalReviewItem`/`approvalItem` presence (shown whenever those relations exist, regardless of section) rather than only in specific sections — this surfaces full history (e.g. an APPROVED post still shows its resolved internal-review badge) without contradicting the spec, which only prescribes the action row per status, not badge visibility rules.

No deviations were needed to satisfy `tsc`/`build` — both passed cleanly on the first attempt after using the exact field names from the GET route and Prisma schema.

## Files touched

- Rewrote: `src/app/admin/(protected)/clients/[id]/page.tsx`
- Read only (no changes): `src/app/admin/(protected)/campaigns/[id]/page.tsx`, `src/components/admin/CarouselCard.tsx`, `src/components/admin/FolderUploadModal.tsx`, `src/components/admin/CopyButton.tsx`, `src/types/index.ts`, `src/app/api/admin/posts/[itemId]/route.ts`, `src/app/api/admin/clients/[id]/route.ts`, `src/app/api/admin/clients/[id]/items/route.ts`, `prisma/schema.prisma`.

## Notes for Task 4 (not performed here — out of scope for this task)

Task 3 only covers the rewrite + typecheck/build + commit, which is complete. Task 4 (logged-in manual verification, hiding old campaign entry points elsewhere in the nav) is a separate task in the plan and was not attempted.
