# Fase 3.3 — Dashboard by stage (cross-client, per-post model)

## Status: DONE

## Commit
`bd03dca59e51525d8654d8d6eccdd795d696f9e4` — `feat(fase3.3): dashboard by stage (cross-client, per-post model)`
(1 file changed, 116 insertions(+), 644 deletions(-))

## What changed
Rewrote `src/app/admin/(protected)/page.tsx` from a campaign-kanban dashboard into a
per-stage, cross-client dashboard driven by `ContentItem.status`.

### Data query
```ts
prisma.client.findMany({
  where: { contentItems: { some: {} } },
  select: {
    id: true,
    name: true,
    contentItems: {
      select: { id: true, status: true, groupId: true, contentType: true, sentToProgramacaoAt: true },
    },
  },
  orderBy: { name: "asc" },
});
```
Only clients with at least one `ContentItem` are fetched (matches the task's example query).

### Post counting (carousel-aware dedupe)
`countDistinctPosts(items, predicate)` dedupes by `groupId` when `contentType === "CARROSSEL"`,
otherwise by `id`, then counts distinct keys matching the predicate. Applied per client to build
a `Record<StageId, number>`, then summed into cross-client totals.

### Stages (in order, matching the spec)
1. `internal` — "Revisão interna" — `status === "INTERNAL_REVIEW"`
2. `internalDone` — "Revisão interna concluída" — `status === "INTERNAL_DONE"` (bonus stage per task's "if easy" note)
3. `clientReview` — "Aguardando cliente" — `status === "CLIENT_REVIEW"`
4. `readyToSchedule` — "Prontos p/ programar" — `status === "APPROVED" && !sentToProgramacaoAt`
5. `inProgramming` — "Na programação" — `status === "APPROVED" && !!sentToProgramacaoAt`
6. `draft` — "Rascunho" — `status === "DRAFT"`

`PUBLISHED` items are intentionally excluded from every bucket (per task instructions to ignore
them on the active board).

### Layout
- Top: `AutoRefresh intervalMs={30000}` preserved (unchanged import/usage from original file).
- Header row: "Dashboard" title + "+ Novo Cliente" button linking to `/admin/clients` (kept from
  original).
- Empty state (`grandTotal === 0`): "Nenhum post em andamento." card with a link to
  `/admin/clients`.
- Stat tile row: one tile per stage (6 tiles) showing the cross-client total, highlighted with
  stage color/background when `> 0`.
- Below: one section per **non-empty** stage, in stage order, each with a colored dot + label +
  total count header, and a card list of clients that have posts in that stage (sorted by count
  desc), each row = client name + post count, linking to `/admin/clients/${client.id}`.
- Dark theme preserved: `#0f0f0f` page background (inherited from layout), `bg-[#1a1a1a]` cards,
  `border-white/10` borders, `divide-white/5` row dividers, pt-BR labels throughout.

### Removed
- All campaign/kanban/billing logic: `getStatusCounts`, `classifyCampaign`,
  `unscheduledNonTextoCount`, the `COLUMNS`/`KanbanCol` kanban, `ChargeButton`,
  `SentToProductionButton`, the retroactive campaign auto-close side effect, the
  ativas/concluídas tabs, notification bar, and the old "Clientes com campanha ativa" section.
- No references remain to campaigns, month/year, or billing in the new file.

## Verification
- `npx tsc --noEmit` → **zero errors**.
- `npm run build` → **succeeded** after clearing a stale `.next` directory that was hitting a
  known OneDrive file-lock artifact (`EINVAL: invalid argument, readlink
  '...\.next\server\edge-runtime-webpack.js.map'`, documented in project memory as the
  "OneDrive .next EBUSY" gotcha). After `rm -rf .next`, `npm run build` completed cleanly:
  `/admin` route compiles as `ƒ (Dynamic)` at 391 B / 96.4 kB First Load JS, alongside all other
  routes.

## Git hygiene
Working tree at task start had unrelated pre-existing modifications:
- `.claude/settings.local.json` (modified)
- `src/app/api/admin/campaigns/[id]/route.ts` (modified)
- `.claude/checkpoints.log`, `.claude/settings.json`, `.superpowers/`, `drive-preview-demo.html` (untracked)

None of these were staged or committed. Only
`src/app/admin/(protected)/page.tsx` was `git add`-ed and committed, per instructions (no
`git add .`).

Note: the commit was first made with a typo in the phase tag (`feat(fase3.2): ...`) and
immediately corrected with `git commit --amend` to the specified `feat(fase3.3): ...` message
before this report was written — no other commits existed in between and nothing was pushed.

## Concerns
- None blocking. The `INTERNAL_DONE` "Revisão interna concluída" bonus stage was added per the
  task's "if easy" allowance; it can be dropped in a follow-up if the product wants it merged
  into "Revisão interna" instead.
- `sentToProgramacaoAt` and `groupId`/`contentType` values were not spot-checked against live
  production data (no DB access in this task) — logic follows the schema and task spec exactly.
