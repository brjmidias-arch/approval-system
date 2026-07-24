# Fase 2 — Task 2: Página `/aprovar/[token]` — redirect + estado vazio evergreen

## Status: DONE

## Commit
`9c13349` — `feat(fase2): client approval page — redirect legacy + evergreen empty state`
(only `src/app/aprovar/[token]/page.tsx` staged/committed; no `git add .`)

## File modified
`c:\Users\mfbro\OneDrive\Documentos\approval-system\src\app\aprovar\[token]\page.tsx`

## Edits applied (exactly 3, no other lines touched)

1. **Import + hook** (line 4 / near other hooks):
   - `import { useParams } from "next/navigation";` → `import { useParams, useRouter } from "next/navigation";`
   - Added `const router = useRouter();` right after `const { token } = useParams<{ token: string }>();`

2. **`fetchCampaign` redirect handling** (~line 70-78):
   - Replaced:
     ```ts
     const data: Campaign = await res.json();
     if (data.status === "CLOSED") { setError("closed"); setLoading(false); return; }
     setCampaign(data);
     ```
     with:
     ```ts
     const data: Campaign & { redirect?: string } = await res.json();
     if (data.redirect) { router.replace(`/aprovar/${data.redirect}`); return; }
     setCampaign(data);
     ```
   - Typed `data` as `Campaign & { redirect?: string }` (instead of plain `Campaign`) so `data.redirect` type-checks cleanly without `any` — this was the only deviation from the plan's literal snippet, needed to satisfy `tsc --noEmit`.
   - The `CLOSED` gate line was removed as instructed. Note: on redirect, `setLoading(false)` is intentionally *not* called (matches the plan's snippet) since the component is about to navigate away via `router.replace`.

3. **Evergreen empty state** — added right after `if (!campaign) return null;` and before `const alreadyApproved = alreadyApprovedGroups;`:
   ```tsx
   if (campaign && groups.length === 0) {
     return (
       <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-8">
         <div className="text-center">
           <p className="text-3xl mb-2">✅</p>
           <p className="text-gray-300">Tudo aprovado! Nenhum post pendente no momento.</p>
         </div>
       </div>
     );
   }
   ```

## Preserved unchanged
- All rendering/grouping/action code (media, carousel swipe, approve/adjust/reject buttons, already-approved section, completion banner, header/footer) untouched.
- The `error === "closed"` branch in the `msgs` object / `error` state type (`"closed" | "not_found"`) was left in place, as instructed ("pode deixá-lo inofensivo") — it's now unreachable via the new flow but harmless and still type-checks.

## Verification
- `npx tsc --noEmit` → exit code 0, zero errors/output.
- `git diff` reviewed before commit; diff is exactly the 3 targeted hunks (import line, redirect logic replacing CLOSED check, new empty-state early-return) — no incidental reformatting or unrelated changes.
- Confirmed only `src/app/aprovar/[token]/page.tsx` was staged (`git status --short` before commit showed other pre-existing unstaged/untracked changes in the repo left untouched, e.g. `.claude/settings.local.json`, `src/app/admin/(protected)/page.tsx`, `src/app/api/admin/campaigns/[id]/route.ts`, `.superpowers/`, etc.).
- Fact-Forcing Gate hook intercepted the first `Edit` call (on the import-line change) and this `Write` call; presented required facts each time and the retries succeeded.

## Concerns
None. The only deviation from the plan's literal code snippet is typing `data` as `Campaign & { redirect?: string }` rather than plain `Campaign` in step 1, done purely to keep `tsc --noEmit` clean (accessing `.redirect` on a `Campaign`-typed object would otherwise error) — behavior is identical to the plan's intent.
