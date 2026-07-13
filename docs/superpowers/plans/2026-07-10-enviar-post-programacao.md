# Botão "Enviar para Programação" por post — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão por post (aprovado pelo cliente) na página da campanha que envia aquele post à Programação imediatamente, mesmo com a campanha aberta, de forma reversível.

**Architecture:** Um campo nullable `sentToProgramacaoAt` no `ContentItem` marca posts adiantados. O PATCH de item liga/desliga o marcador (propagando no carrossel). A página da Programação passa a incluir posts com esse marcador além dos de campanhas fechadas. A UI da campanha mostra botão/selo por post.

**Tech Stack:** Next.js 14 App Router, React (client components), Prisma, PostgreSQL (Supabase), TypeScript, Tailwind.

## Global Constraints

- **Campo novo nullable:** `ContentItem.sentToProgramacaoAt DateTime?`. Migração aditiva.
- **Botão só em posts com `approvalItem.status === "APPROVED"`** (cliente aprovou). Nunca em `TEXTO`.
- **Carrossel:** marcador aplicado a todos os slides do `groupId`; UI usa o representante `slides[0]`.
- **`resetApproval` (Ajuste feito) também limpa `sentToProgramacaoAt`.**
- **Programação preserva comportamento atual:** campanhas `CLOSED`/`PUBLISHED` continuam listando todos os aprovados.
- **Ordem de deploy:** migração aplicada no Supabase ANTES de o código subir (o build só faz `prisma generate`, não migra).
- **Sem framework de testes** — verificar com `npx tsc --noEmit` e `npm run build`. **NÃO** rodar `npm run lint` (ESLint não configurado; só abre wizard interativo).
- Tema escuro (`#0f0f0f`, `white/10`), labels pt-BR, `@` → `src/`.

---

## File Structure

- `prisma/schema.prisma` — **modificar**. Adiciona `sentToProgramacaoAt` ao `ContentItem`.
- `src/app/api/admin/campaigns/[id]/items/[itemId]/route.ts` — **modificar**. PATCH aceita `sentToProgramacao`; propaga no grupo; limpa no `resetApproval`.
- `src/app/admin/(protected)/campaigns/[id]/page.tsx` — **modificar**. Campo na interface, handler, botão/selo no card de post único.
- `src/components/admin/CarouselCard.tsx` — **modificar**. Campo na interface, handler local, botão/selo no carrossel.
- `src/app/admin/(protected)/programacao/page.tsx` — **modificar**. Query e filtro incluem posts marcados.

---

## Task 1: Migração — campo `sentToProgramacaoAt`

**Files:**
- Modify: `prisma/schema.prisma` (model `ContentItem`)

**Interfaces:**
- Produces: coluna `sentToProgramacaoAt DateTime?` no `ContentItem`, disponível no Prisma Client para todas as tasks seguintes.

- [ ] **Step 1: Adicionar o campo ao schema**

Em `prisma/schema.prisma`, no model `ContentItem`, adicionar a linha após `postedAt`:

```prisma
  postedAt           DateTime?
  sentToProgramacaoAt DateTime?
```

- [ ] **Step 2: Gerar e aplicar a migração**

Run: `npx prisma migrate dev --name add_sent_to_programacao`
Expected: cria `prisma/migrations/<timestamp>_add_sent_to_programacao/migration.sql` com `ALTER TABLE "ContentItem" ADD COLUMN "sentToProgramacaoAt" TIMESTAMP(3);` e aplica no banco; regenera o Prisma Client. Saída termina com "Your database is now in sync with your schema."

- [ ] **Step 3: Confirmar o Client tipado**

Run: `npx tsc --noEmit`
Expected: zero erros (o campo passa a existir no tipo `ContentItem` do Prisma).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add sentToProgramacaoAt column to ContentItem"
```

---

## Task 2: PATCH de item — ligar/desligar + propagação + limpeza no reset

**Files:**
- Modify: `src/app/api/admin/campaigns/[id]/items/[itemId]/route.ts`

**Interfaces:**
- Consumes: coluna `sentToProgramacaoAt` (Task 1).
- Produces: `PATCH /api/admin/campaigns/[id]/items/[itemId]` aceita `{ sentToProgramacao: boolean }` — `true` seta `sentToProgramacaoAt = new Date()`, `false` seta `null`; propaga a todos os itens do `groupId` quando carrossel. O `resetApproval` passa a limpar `sentToProgramacaoAt` (item e grupo).

- [ ] **Step 1: Ler `sentToProgramacao` do body e aplicar no update do item**

Em `src/app/api/admin/campaigns/[id]/items/[itemId]/route.ts`, na desestruturação do body (linha ~10), adicionar `sentToProgramacao`:

```ts
  const { title, caption, scheduledDate, fileUrl, fileType, driveUrl, coverUrl, coverDriveUrl, resetApproval, resetInternalReview, postedAt, sentToProgramacao } = body;
```

No objeto `data` do `prisma.contentItem.update` (dentro dos spreads, após o de `postedAt`), adicionar:

```ts
        ...(sentToProgramacao !== undefined && {
          sentToProgramacaoAt: sentToProgramacao ? new Date() : null,
        }),
```

- [ ] **Step 2: Propagar ao grupo do carrossel**

Logo após o bloco existente que propaga `scheduledDate` para o grupo (o `if (scheduledDate !== undefined && item.groupId && item.contentType === "CARROSSEL")`), adicionar um bloco análogo:

```ts
    if (sentToProgramacao !== undefined && item.groupId && item.contentType === "CARROSSEL") {
      await prisma.contentItem.updateMany({
        where: { campaignId: params.id, groupId: item.groupId, id: { not: params.itemId } },
        data: { sentToProgramacaoAt: sentToProgramacao ? new Date() : null },
      });
    }
```

- [ ] **Step 3: Limpar `sentToProgramacaoAt` no `resetApproval`**

O `resetApproval` reseta a aprovação do post. Como o post deixa de estar aprovado, ele deve sair da Programação. Substituir o bloco `if (resetApproval) { ... }` existente por:

```ts
    if (resetApproval) {
      await prisma.approvalItem.updateMany({
        where: { contentItemId: params.itemId },
        data: { status: "PENDING", clientCommentResolved: true, reviewedAt: null },
      });
      if (item.groupId && item.contentType === "CARROSSEL") {
        await prisma.contentItem.updateMany({
          where: { campaignId: params.id, groupId: item.groupId },
          data: { sentToProgramacaoAt: null },
        });
      } else {
        await prisma.contentItem.update({
          where: { id: params.itemId },
          data: { sentToProgramacaoAt: null },
        });
      }
    }
```

Nota: `item` já está disponível (resultado do `update` no início do handler). Propagar ao grupo aqui é seguro e idempotente.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/campaigns/[id]/items/[itemId]/route.ts"
git commit -m "feat: toggle sentToProgramacao on item PATCH; clear on resetApproval"
```

---

## Task 3: Página da campanha — botão/selo no post único

**Files:**
- Modify: `src/app/admin/(protected)/campaigns/[id]/page.tsx`

**Interfaces:**
- Consumes: PATCH `{ sentToProgramacao }` (Task 2); campo `sentToProgramacaoAt` no item retornado pelo GET.
- Produces: nada consumido por outra task.

- [ ] **Step 1: Adicionar o campo à interface `ContentItem`**

Na `interface ContentItem` (linha ~26), adicionar após `order: number;`:

```ts
  order: number;
  sentToProgramacaoAt: string | null;
```

- [ ] **Step 2: Adicionar estado e handler de toggle**

Junto dos outros `useState` (perto de `const [markingDoneItemId, setMarkingDoneItemId] = useState<string | null>(null);`, linha ~73), adicionar o estado:

```ts
  const [togglingProgItemId, setTogglingProgItemId] = useState<string | null>(null);
```

Perto do handler `handleMarkItemDone` (linha ~288), adicionar o handler novo:

```ts
  async function handleToggleProgramacao(itemId: string, next: boolean) {
    setTogglingProgItemId(itemId);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentToProgramacao: next }),
      });
      if (!res.ok) throw new Error();
      fetchCampaign();
    } catch {
      alert("Erro ao atualizar a programação. Tente novamente.");
    } finally {
      setTogglingProgItemId(null);
    }
  }
```

- [ ] **Step 3: Adicionar botão/selo no card de post único**

No bloco de ações do post único (`<div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">`, ~linha 1076), após o `<span>` de status (o que usa `APPROVAL_STATUS_LABELS[statusKey]`, ~linha 1106-1108) e antes do bloco `{(statusKey === "ADJUSTMENT" ...)}`, adicionar:

```tsx
                      {statusKey === "APPROVED" && (
                        item.sentToProgramacaoAt ? (
                          <>
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sky-900/30 text-sky-400">
                              ✓ Na Programação
                            </span>
                            <button
                              onClick={() => handleToggleProgramacao(item.id, false)}
                              disabled={togglingProgItemId === item.id}
                              className="text-xs px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {togglingProgItemId === item.id ? "..." : "Remover da Programação"}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleToggleProgramacao(item.id, true)}
                            disabled={togglingProgItemId === item.id}
                            className="text-xs px-2.5 py-1 bg-sky-900/40 hover:bg-sky-900/60 text-sky-400 border border-sky-500/30 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {togglingProgItemId === item.id ? "..." : "→ Programação"}
                          </button>
                        )
                      )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(protected)/campaigns/[id]/page.tsx"
git commit -m "feat: send-to-programacao button on single post card"
```

---

## Task 4: CarouselCard — botão/selo no carrossel

**Files:**
- Modify: `src/components/admin/CarouselCard.tsx`

**Interfaces:**
- Consumes: PATCH `{ sentToProgramacao }` (Task 2). Recebe `slides` (cada slide já traz `sentToProgramacaoAt` pois vem do `ContentItem` da campanha).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Adicionar o campo à interface `SlideItem`**

Na `interface SlideItem` (linha ~22), adicionar após `order: number;`:

```ts
  order: number;
  sentToProgramacaoAt: string | null;
```

- [ ] **Step 2: Adicionar estado e handler local**

Perto de `const [markingDone, setMarkingDone] = useState(false);` (linha ~264), adicionar:

```ts
  const [togglingProg, setTogglingProg] = useState(false);

  const inProgramacao = slides[0]?.sentToProgramacaoAt != null;
  const carouselApproved = slides[0]?.approvalItem?.status === "APPROVED";

  async function handleToggleProgramacao(next: boolean) {
    setTogglingProg(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/items/${slides[0].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentToProgramacao: next }),
      });
      if (!res.ok) throw new Error();
      setSlides((prev) => prev.map((s) => ({ ...s, sentToProgramacaoAt: next ? new Date().toISOString() : null })));
    } catch {
      alert("Erro ao atualizar a programação. Tente novamente.");
    } finally {
      setTogglingProg(false);
    }
  }
```

- [ ] **Step 3: Adicionar botão/selo na linha de botões**

Na `<div className="flex gap-2 mt-3">` (linha ~388), após o botão "🔗 Link p/ designer" (o que fecha com `{linkCopied ? "Copiado!" : "🔗 Link p/ designer"}` seguido de `</button>`, ~linha 400) e antes do bloco `{hasAdjustments && (`, adicionar:

```tsx
        {carouselApproved && (
          inProgramacao ? (
            <>
              <span className="text-xs px-3 py-1.5 rounded-lg font-medium bg-sky-900/30 text-sky-400 self-center">
                ✓ Na Programação
              </span>
              <button
                onClick={() => handleToggleProgramacao(false)}
                disabled={togglingProg}
                className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors disabled:opacity-50"
              >
                {togglingProg ? "..." : "Remover da Programação"}
              </button>
            </>
          ) : (
            <button
              onClick={() => handleToggleProgramacao(true)}
              disabled={togglingProg}
              className="text-xs px-3 py-1.5 bg-sky-900/40 hover:bg-sky-900/60 text-sky-400 border border-sky-500/30 rounded-lg transition-colors disabled:opacity-50"
            >
              {togglingProg ? "..." : "→ Programação"}
            </button>
          )
        )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/CarouselCard.tsx
git commit -m "feat: send-to-programacao button on carousel card"
```

---

## Task 5: Página da Programação — incluir posts marcados

**Files:**
- Modify: `src/app/admin/(protected)/programacao/page.tsx`

**Interfaces:**
- Consumes: coluna `sentToProgramacaoAt` (Task 1).
- Produces: Programação lista posts aprovados de campanhas fechadas OU posts com `sentToProgramacaoAt != null`.

- [ ] **Step 1: Ampliar a query e o select**

Em `src/app/admin/(protected)/programacao/page.tsx`, na `prisma.campaign.findMany`, trocar o `where` e adicionar `sentToProgramacaoAt` ao `select` de `contentItems`.

Trocar:
```ts
    where: { status: { in: ["CLOSED", "PUBLISHED"] } },
```
Por:
```ts
    where: {
      OR: [
        { status: { in: ["CLOSED", "PUBLISHED"] } },
        { contentItems: { some: { sentToProgramacaoAt: { not: null } } } },
      ],
    },
```

No `select` de `contentItems`, adicionar após `postedAt: true,`:
```ts
          postedAt: true,
          sentToProgramacaoAt: true,
```

- [ ] **Step 2: Filtrar os posts incluídos em `getApprovedPosts`**

Dentro de `getApprovedPosts`, o loop já pula TEXTO, itens escondidos pela revisão interna, e itens sem aprovação `APPROVED`. Adicionar, logo após a linha `if (approval?.status !== "APPROVED") continue;`, o gate de etapa:

```ts
      if (approval?.status !== "APPROVED") continue;
      // Só entra na Programação se a campanha está fechada/publicada
      // OU o post foi explicitamente enviado à programação.
      const campaignReleased = campaign.status === "CLOSED" || campaign.status === "PUBLISHED";
      if (!campaignReleased && !item.sentToProgramacaoAt) continue;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Build completo**

Run: `npm run build`
Expected: build conclui sem erros (`prisma generate` + `next build`); rota `/admin/programacao` compila.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(protected)/programacao/page.tsx"
git commit -m "feat: include early-advanced posts in programacao"
```

---

## Self-Review (feito na escrita)

- **Cobertura da spec:** campo/migração (Task 1); PATCH toggle + propagação carrossel + limpeza no resetApproval (Task 2); botão/selo post único (Task 3); botão/selo carrossel (Task 4); query + filtro da Programação (Task 5). Critérios 1–7 cobertos. ✅
- **Sem placeholders:** todo código completo. ✅
- **Consistência de tipos:** `sentToProgramacaoAt` é `DateTime?` no Prisma → serializado como `string | null` no JSON, e as interfaces `ContentItem` (Task 3) e `SlideItem` (Task 4) usam `string | null`. O body `{ sentToProgramacao: boolean }` bate entre Tasks 2/3/4. ✅
- **Regressão:** campanhas `CLOSED`/`PUBLISHED` continuam listando tudo (ramo do OR + `campaignReleased`). ✅
- **Nota de deploy:** a migração da Task 1 já roda contra o Supabase via `migrate dev`; como é DB único, isso cobre produção. O código só sobe depois. ✅
