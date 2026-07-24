# Task 3 Report — Página da campanha: botão/selo no post único

## Status: DONE

## File modified
`src/app/admin/(protected)/campaigns/[id]/page.tsx` (43 insertions, 0 deletions)

## Changes applied (verbatim from plan, Task 3)

1. **Interface field** — added `sentToProgramacaoAt: string | null;` to `interface ContentItem`, right after `order: number;`.

2. **State** — added `const [togglingProgItemId, setTogglingProgItemId] = useState<string | null>(null);` alongside the existing `markingDoneItemId` state.

3. **Handler** — added `async function handleToggleProgramacao(itemId: string, next: boolean)` right before `openTextModal`, mirroring `handleMarkItemDone`: sets `togglingProgItemId`, PATCHes `/api/admin/campaigns/${id}/items/${itemId}` with `{ sentToProgramacao: next }`, calls `fetchCampaign()` on success, shows a pt-BR alert on failure, and clears the toggling state in `finally`.

4. **JSX button/badge** — inserted inside the single-post actions div (`<div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">`), immediately after the status `<span>` that renders `APPROVAL_STATUS_LABELS[statusKey]}` and before the `{(statusKey === "ADJUSTMENT" || statusKey === "REJECTED") && (...)}` block. Gated on `statusKey === "APPROVED"`:
   - If `item.sentToProgramacaoAt` is set: shows a sky-colored "✓ Na Programação" badge plus a "Remover da Programação" button (PATCH `sentToProgramacao: false`).
   - Otherwise: shows a "→ Programação" button (PATCH `sentToProgramacao: true`).
   - Both buttons disable while `togglingProgItemId === item.id` and show "..." as loading state.

## Verification

- `npx tsc --noEmit` → **zero errors** (ran from repo root, full output empty/clean).
- Confirmed via `git status --short` that only this file was staged before commit (pre-existing unrelated changes to `.claude/settings.local.json`, `src/app/admin/(protected)/page.tsx`, `src/app/api/admin/campaigns/[id]/route.ts`, `src/app/api/approval/[token]/route.ts`, and untracked files were left untouched/unstaged).
- Committed with `git add "src/app/admin/(protected)/campaigns/[id]/page.tsx"` then `git commit -m "feat: send-to-programacao button on single post card"`.

## Commit
`fd68714d1f4a717e3c0d2a49f0c3e30b63aeefa9` — "feat: send-to-programacao button on single post card"

## Concerns
None. Code matches the plan verbatim. Note: this task only wires up the single-post card; the carousel card (Task 4) and the Programação page filter (Task 5) are separate tasks not covered here — until those land, the button is visually present but the item won't yet show up filtered into `/admin/programacao` unless the campaign is already CLOSED/PUBLISHED (expected, per plan sequencing).
