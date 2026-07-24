# Fase 2 — Task 4 Report: `/revisar/[token]` — redirect + evergreen + drop batch finalize

## Status
DONE

## Commit
`0586b80` — "feat(fase2): internal review page — redirect + evergreen + drop batch finalize"
(1 file changed, 9 insertions(+), 95 deletions(-))

## File modified
- `src/app/revisar/[token]/page.tsx`

## Edits applied

### 1. `useRouter`
- Import changed: `import { useParams, useRouter } from "next/navigation";`
- Added `const router = useRouter();` next to the other hooks (after `useParams`).

### 2. Redirect handling in `fetchCampaign`
- After `await res.json()`, the response is now typed `Campaign & { redirect?: string }` and:
  ```ts
  if (data.redirect) { router.replace(`/revisar/${data.redirect}`); return; }
  ```
  runs before `setCampaign(data)`.
- No pre-existing `campaign.status`-based UI gate was found in the file (there was never a check like `if (campaign.status === "INTERNAL_DONE") { ... }` blocking rendering), so nothing needed to be removed on that front — confirmed by reading the full file before editing. The page already renders whatever `contentItems`/groups come back from the API.

### 3. Evergreen empty-state
Added, right after the `notFound` early-return and before `if (!campaign) return null;`:
```tsx
if (campaign && groups.length === 0) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-3xl mb-2">✅</p>
        <p className="text-gray-300">Nenhum post aguardando revisão interna.</p>
      </div>
    </div>
  );
}
```
Uses the actual state variable name in this file, `campaign` (this page never renamed it to something else, unlike what the task anticipated might happen).

### 4. Removed batch flow
Removed:
- State: `submitting`, `copied`, `submitted`, `submitResult`, `sendingToClient`, `sentToClient` (6 `useState` declarations).
- Function: `handleSubmit()` (called `POST /api/internal/${token}/submit`).
- The entire post-submit results screen: `if (submitted && submitResult && campaign) { ... }` block, including:
  - The "Revisão Interna Concluída!" summary screen (aprovados/ajuste/reprovados counts).
  - The "Copiar mensagem e enviar para o cliente" panel (WhatsApp message builder + button that called `POST /api/internal/${campaign.internalToken}/send-client` and used `navigator.clipboard.writeText`).
- The sticky "Finalizar Revisão Interna" button block at the bottom of the main render (`{/* Submit */} <div className="sticky bottom-4 pt-2"> ... </div>`), which referenced `handleSubmit`, `allDone`, `submitting`.
- The now-unused `allDone` local variable (`const allDone = (reviewedCount === total && total > 0) || ...`), since its only consumer was the removed submit button.

### Kept untouched
- Per-post review actions: `setGroupStatus`, `saveGroupReview`, `handleCommentSave`, and the Aprovar/Ajuste/Reprovar buttons + comment textarea (all still PATCH `/api/internal/${token}`).
- All post/carousel rendering (media, captions, Drive links, carousel swipe/dots, "Já aprovados" section).
- Header progress bar (`reviewedCount`/`total`/`progress`) — still computed and shown; unrelated to the batch-submit removal since it's just a visual review-progress indicator tied to `needsReviewGroups`/`reviews` state, not to the submit button.
- `notFound` / loading screens, footer.

## Verification
- `npx tsc --noEmit` → **zero errors**, exit code 0. No dangling references to removed state/handlers remained.
- `npm run build` / `npm run lint` were **not** run per instructions (lint explicitly excluded; build not requested for this sub-task report though tsc alone was clean).

## Concerns
- None functional. Note for awareness: `alreadyApprovedGroups`/`needsReviewGroups` splitting logic (based on `internalReviewItem.status === "APPROVED"`) was left as-is per scope (not part of the batch-flow removal); under the new evergreen API contract, approved items should generally no longer be returned by `GET /api/internal/[token]` at all (per Task 3), so `alreadyApprovedGroups` is expected to normally stay empty in practice — this is existing/expected behavior, not something this task was asked to change.
