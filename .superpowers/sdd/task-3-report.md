# Task 3 Report: Página pública `/programar/[clientId]`

## Status: DONE

## Note on file collision

A pre-existing `.superpowers/sdd/task-3-report.md` was found at the start of this task,
but it documented a **different, unrelated task** ("Página da campanha: botão/selo no
post único" — the send-to-programação button on the campaign detail page, apparently
from an earlier/different plan run that reused the same `task-N-report.md` naming
convention). That file was untracked in git, so nothing was lost from version control,
but to avoid destroying that documentation it was backed up to
`.superpowers/sdd/task-3-report.sentToProgramacao-button.md` before this file was
overwritten with the report for the actual Task 3 of
`docs/superpowers/plans/2026-07-10-link-programacao-social-media.md` (the plan named in
this task's instructions, and the same plan referenced by `.superpowers/sdd/progress.md`).

## What was done

1. Read Task 3 spec from `docs/superpowers/plans/2026-07-10-link-programacao-social-media.md` (lines 331-517).
2. Verified prerequisites already in place:
   - `src/lib/programacao.ts` exports `SchedulablePost` interface matching the fields used by the page (id, campaignId, campaignName, title, contentType, fileType, fileUrl, coverUrl, coverDriveUrl, caption, driveUrl, groupId, scheduledDate, postedAt, approvedAt).
   - `src/app/api/programar/[clientId]/route.ts` (GET/PATCH) exists from Tasks 1-2.
   - `src/components/admin/CopyButton.tsx` exists with `{ text }` prop, default export.
   - `Glob("src/app/programar/**")` returned no files — confirmed no pre-existing page to conflict with.
3. Created `src/app/programar/[clientId]/page.tsx` using the exact code block from the plan (verbatim, no modifications):
   - `"use client"` component using `useParams` to read `clientId`.
   - Fetches `GET /api/programar/${clientId}` on mount (`cache: "no-store"`); sets `notFound` on non-OK response or fetch error.
   - Loading state: "Carregando..." on `#0f0f0f` background.
   - Not-found state: "Cliente não encontrado." in red.
   - Renders `data.clientName`, a post count summary in pt-BR, and campaigns grouped list.
   - Each post card shows: thumbnail (image/video icon/doc icon by `fileType`), title, content-type badge (pt-BR labels), scheduled date (`toLocaleDateString("pt-BR", { timeZone: "UTC", ... })`), "Agendado ✓" button that PATCHes `{ contentItemId: postId }` and removes the post from local state on success (with per-post `markingId` loading indicator and an `alert()` on failure).
   - Drive links section (file link, and cover link only for `REELS`).
   - Caption block with `CopyButton`.
   - Dark theme (`#0f0f0f`, `white/[0.08]` borders), pt-BR labels throughout, `@` alias imports.
4. Ran `npx tsc --noEmit` from repo root — completed with **zero output / zero errors**.
5. Staged only the new file (`git add "src/app/programar/[clientId]/page.tsx"`) — confirmed via `git status --short` that only this file was staged (`A`), while pre-existing unrelated modifications (`.claude/settings.local.json`, `src/app/admin/(protected)/page.tsx`, `src/app/api/admin/campaigns/[id]/route.ts`, `src/app/api/approval/[token]/route.ts`) and untracked files remained untouched.
6. Committed: `feat: public per-client programacao page for social media` → commit `960a458`.

## Fact-Forcing Gate

The Write tool's local hook intercepted the first attempt and required inline facts (caller, duplicate check, data shape, verbatim instruction) before allowing the write. These were provided in-conversation and the write succeeded on retry. No plan-file or code changes resulted from this — it was purely a policy gate.

## Verification

- `npx tsc --noEmit`: zero errors.
- `git show 960a458 --stat`: 1 file changed, 159 insertions(+), matches `src/app/programar/[clientId]/page.tsx` only.
- No `npm run lint` run (per instructions — ESLint not configured in this repo).

## Concerns

None regarding the implementation itself — code was used verbatim from the plan, and types (`SchedulablePost`) and the PATCH body shape (`{ contentItemId }`) match the already-implemented API route and shared lib exactly. See "Note on file collision" above for a housekeeping note about the `.superpowers/sdd/` report filename convention colliding across plans.
