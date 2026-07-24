# Fase 3.2 — Task 2: FolderUploadModal — modo client-scoped

## Status: DONE

## Commit
`61ce09b` — "feat(fase3.2): FolderUploadModal supports client-scoped upload"

## Changes
File: `src/components/admin/FolderUploadModal.tsx`

1. `Props` interface:
   - `campaignId: string` → `campaignId?: string` (now optional)
   - Added `clientId?: string`
2. Component signature destructures `clientId` from props.
3. `handleSave`:
   - Added `const endpoint = campaignId ? \`/api/admin/campaigns/${campaignId}/items\` : \`/api/admin/clients/${clientId}/items\`;` right after `setStep("saving")`.
   - The single POST call inside the slide loop now uses `fetch(endpoint, ...)` instead of the hardcoded campaign URL. Request body unchanged (still includes all the same fields; the client endpoint ignores the absence of `campaignId` per plan note).
   - There was only one POST-to-items call site in this file, so only one fetch call needed updating.

## Verification
- `npx tsc --noEmit` → zero errors/output (clean pass).
- Confirmed only one importer of `FolderUploadModal`: `src/app/admin/(protected)/campaigns/[id]/page.tsx`, which passes `campaignId={id}` (and not `clientId`) — still typechecks fine since `campaignId` is optional and `clientId` defaults to `undefined`. Behavior for that call site is unchanged (endpoint still resolves to the campaign items route because `campaignId` is truthy).
- Did not run `npm run lint` per instructions.

## Commit scope
Only `src/components/admin/FolderUploadModal.tsx` was staged and committed (verified via `git status --short` before commit — other pre-existing unrelated modified/untracked files in the repo were left untouched and unstaged).

## Concerns
None. Change is minimal, additive, and backward-compatible with the existing campaign-scoped call site. Task 3 (rewriting `/admin/clients/[id]` page to actually pass `clientId` to this modal) is out of scope for this task and not yet done.
