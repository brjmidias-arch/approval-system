# Task 1 Report — Refactor: extract getSchedulablePosts to src/lib/programacao

## What was done

Followed the plan file's Task 1 section
(`docs/superpowers/plans/2026-07-10-link-programacao-social-media.md`) verbatim: a pure
move + rename of the post-selection logic out of the admin Programação page, with no
behavior change.

1. **Created `src/lib/programacao.ts`** — exact code from the plan:
   - `export interface SchedulablePost { ... }` (identical shape to the old local `Post`
     interface in `ProgramacaoKanban.tsx`).
   - `export interface SchedulableInputCampaign { ... }` (structural input type matching
     the Prisma query result shape used by the admin page: `id`, `name`, `status`,
     `approvalItems[]`, `contentItems[]` with the exact `select`ed fields).
   - `export function getSchedulablePosts(campaign): SchedulablePost[]` — byte-for-byte
     the same filtering/grouping logic as the old `getApprovedPosts` (TEXTO skip,
     internal-review-hidden skip, APPROVED-only, campaign-released-or-sent gate,
     carousel grouping by `groupId` with `seen` dedup, base fields spread).

2. **Modified `src/components/admin/ProgramacaoKanban.tsx`**:
   - Added `import { type SchedulablePost } from "@/lib/programacao";` after the existing
     `PlannerCalendar`/`CopyButton` imports.
   - Replaced `export interface Post { ... }` (16 fields) with
     `export type Post = SchedulablePost;`.
   - `CampaignData` (which references `Post`) was left untouched, as instructed.

3. **Modified `src/app/admin/(protected)/programacao/page.tsx`**:
   - Import line changed from
     `import ProgramacaoKanban, { type CampaignData, type Post } from "@/components/admin/ProgramacaoKanban";`
     to
     `import ProgramacaoKanban, { type CampaignData } from "@/components/admin/ProgramacaoKanban";`
     with a new line
     `import { getSchedulablePosts } from "@/lib/programacao";` right after.
   - Removed the local `type CampaignWithItems = (typeof campaigns)[0];` and the entire
     local `getApprovedPosts` function (57 lines).
   - Changed the call site from `const posts = getApprovedPosts(campaign);` to
     `const posts = getSchedulablePosts(campaign);`.

No other lines in either file were touched. The rest of `page.tsx` (urgency sort, tabs,
JSX) is unchanged.

## Verification

- `npx tsc --noEmit` → **zero errors** ("TypeScript compilation completed").
- `npm run build` → **success**. Prisma client generated, Next.js build compiled
  successfully, all 20 routes generated including
  `/admin/programacao` (3.34 kB, First Load JS 120 kB) — proving no regression to the
  admin Programação page.

## Commit

Staged only the three intended files
(`src/lib/programacao.ts`, `src/components/admin/ProgramacaoKanban.tsx`,
`src/app/admin/(protected)/programacao/page.tsx`) via explicit `git add` (not `git add .`),
confirmed via `git status` that the pre-existing unrelated working-tree changes
(`.claude/settings.local.json`, `src/app/admin/(protected)/page.tsx`,
`src/app/api/admin/campaigns/[id]/route.ts`, `src/app/api/approval/[token]/route.ts`, and
untracked files) remained untouched/unstaged.

Commit hash: `3edfc681007e55ad5bdbd59437630a17230b1e4f`
Commit message: `refactor: extract getSchedulablePosts to src/lib/programacao`

## Concerns

None. The refactor is a verbatim move: same filtering rules, same carousel grouping,
same field mapping. tsc and build both pass. Admin behavior is unaffected — this only
lays groundwork for a later public API task to reuse `getSchedulablePosts`.
