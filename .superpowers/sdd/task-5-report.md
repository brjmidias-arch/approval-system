# Task 5 Report — Página da Programação: incluir posts marcados

## Status: DONE

## File modified
- `src/app/admin/(protected)/programacao/page.tsx`

## Edits applied (exactly per plan Task 5)

1. **Broadened `where` clause** in `prisma.campaign.findMany` from
   `where: { status: { in: ["CLOSED", "PUBLISHED"] } }` to:
   ```ts
   where: {
     OR: [
       { status: { in: ["CLOSED", "PUBLISHED"] } },
       { contentItems: { some: { sentToProgramacaoAt: { not: null } } } },
     ],
   },
   ```

2. **Added `sentToProgramacaoAt: true`** to the `contentItems` `select`, right after `postedAt: true,`.

3. **Added the `campaignReleased` gate** in `getApprovedPosts`, immediately after
   `if (approval?.status !== "APPROVED") continue;`:
   ```ts
   // Só entra na Programação se a campanha está fechada/publicada
   // OU o post foi explicitamente enviado à programação.
   const campaignReleased = campaign.status === "CLOSED" || campaign.status === "PUBLISHED";
   if (!campaignReleased && !item.sentToProgramacaoAt) continue;
   ```

## Notes on process

- The first Edit call (the `where` clause change) was intercepted by a local
  "Fact-Forcing Gate" hook requiring inline facts (importers, affected
  symbols, data shape, verbatim instruction) before allowing the edit. Facts
  were provided (no importers — this is a Next.js file-system-routed page,
  not imported anywhere; affected symbol is the default-exported
  `ProgramacaoPage` server component and its internal `getApprovedPosts`
  helper; data shape is `Campaign.status` enum + `ContentItem.sentToProgramacaoAt`
  DateTime?/ISO string) and the edit was retried successfully. The other two
  edits (select field, gate line) succeeded on the first attempt.

## Verification

### `npx tsc --noEmit`
Zero errors.

### `npm run build`
Completed successfully: `prisma generate` (Prisma Client v5.22.0 generated,
no errors — only an informational "update available" notice) followed by
`next build`, which compiled successfully, passed type checking/linting, and
generated all 20 static/dynamic pages including `/admin/programacao`
(3.34 kB, 120 kB First Load JS). No build errors of any kind, and no
missing-env/DB issues were encountered.

## Commit

- Staged only: `src/app/admin/(protected)/programacao/page.tsx`
  (verified via `git status --short` that no other files were staged)
- Commit message: `feat: include early-advanced posts in programacao`
- Commit hash: `4107fb2`
- 1 file changed, 11 insertions(+), 1 deletion(-)

## Concerns

None. All three edits match the plan verbatim, typecheck and build are both
clean, and the commit contains only the intended file.
