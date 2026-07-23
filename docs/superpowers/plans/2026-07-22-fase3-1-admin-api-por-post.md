# Fase 3.1 — Admin: API por post (client-scoped) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a base de backend do admin no modelo por post: endpoints para **criar posts direto no cliente** e para **mover a etapa (`status`) de um post** (enviar p/ revisão interna, enviar p/ cliente, marcar publicado), com propagação por carrossel e reset de aprovação no reenvio. Sem UI ainda (a UI é a 3.2).

**Architecture:** Rotas novas **client/post-centric**, aditivas (as rotas de campanha continuam existindo até a Fase 4): `POST /api/admin/clients/[id]/items` (cria post no cliente, `status=DRAFT`) e `PATCH`/`DELETE /api/admin/posts/[itemId]` (edições + transições de etapa + exclusão). Transições setam `ContentItem.status` e criam/resetam `ApprovalItem`/`InternalReviewItem` conforme a etapa. "Ajuste feito" = reenviar (reusa send-internal/send-client, que resetam a review anterior — resolve o item deferido da Fase 2).

**Tech Stack:** Next.js 14 App Router, Prisma, TypeScript, NextAuth (rotas admin são auth-gated).

## Global Constraints

- **Deploy bundlado** (Fases 2–4). Commit local; não sobe sozinha.
- **Aditivo:** não remover/alterar as rotas de campanha existentes (limpeza é Fase 4).
- **Auth:** rotas sob `/api/admin/*` são protegidas pelo middleware (sessão NextAuth). Seguir o padrão de `getServerSession` das rotas admin existentes que o usam (ex.: `send-internal`).
- **Carrossel:** transição/edição/exclusão que afeta um post de carrossel propaga a todos os itens do `groupId` (padrão já usado em `items/[itemId]` para `scheduledDate`/`sentToProgramacao`).
- **Reset no reenvio:** enviar p/ cliente reseta `ApprovalItem`→PENDING; enviar p/ revisão interna reseta `InternalReviewItem`→PENDING (evita o item ficar preso em "já aprovado").
- **Status do post** ∈ `DRAFT | INTERNAL_REVIEW | INTERNAL_DONE | CLIENT_REVIEW | APPROVED | PUBLISHED`.
- Sem testes automatizados — `npx tsc --noEmit` + `npm run build`. Verificação runtime completa fica para a 3.2 (UI logada) ou sessão autenticada; aqui, verificação por tipos/build + simulação Prisma das transições. **NÃO** `npm run lint`.
- `@` → `src/`. Prisma em `@/lib/prisma`.

---

## File Structure

- `src/app/api/admin/clients/[id]/items/route.ts` — **criar**. `POST` cria post no cliente.
- `src/app/api/admin/posts/[itemId]/route.ts` — **criar**. `PATCH` (edição + transições) e `DELETE`.

---

## Task 1: `POST /api/admin/clients/[id]/items` — criar post no cliente

**Files:**
- Create: `src/app/api/admin/clients/[id]/items/route.ts`

**Interfaces:**
- Produces: `POST /api/admin/clients/[id]/items` body `{ fileUrl, fileType, title?, caption?, scheduledDate?, driveUrl?, coverUrl?, coverDriveUrl?, contentType, groupId?, order? }` → cria `ContentItem` com `clientId` e `status="DRAFT"` (sem approval/review items ainda). 201 com o item.

- [ ] **Step 1: Confirmar o export de auth**

Verificar em `src/lib/auth.ts` o nome exportado (esperado `authOptions`) e como as rotas admin existentes fazem `getServerSession`. Usar o mesmo import nas rotas novas.

- [ ] **Step 2: Criar a rota**

Create `src/app/api/admin/clients/[id]/items/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const client = await prisma.client.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const body = await req.json();
  const { fileUrl, fileType, title, caption, scheduledDate, driveUrl, coverUrl, coverDriveUrl, contentType, groupId, order } = body;
  if (!fileUrl || !fileType || !contentType) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  try {
    const item = await prisma.contentItem.create({
      data: {
        clientId: client.id,
        status: "DRAFT",
        fileUrl,
        fileType,
        title: title || null,
        caption: caption || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        driveUrl: driveUrl || null,
        coverUrl: coverUrl || null,
        coverDriveUrl: coverDriveUrl || null,
        contentType,
        groupId: groupId || null,
        order: order ?? 0,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar post" }, { status: 500 });
  }
}
```
(`campaignId` é opcional agora, então é omitido. Não cria `ApprovalItem`/`InternalReviewItem` — eles são criados nas transições da Task 2.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/admin/clients/[id]/items/route.ts"
git commit -m "feat(fase3.1): POST /api/admin/clients/[id]/items (create post on client)"
```

---

## Task 2: `PATCH`/`DELETE /api/admin/posts/[itemId]` — edições + transições + exclusão

**Files:**
- Create: `src/app/api/admin/posts/[itemId]/route.ts`

**Interfaces:**
- Produces:
  - `PATCH /api/admin/posts/[itemId]` body pode conter: edições `{ title?, caption?, scheduledDate?, driveUrl?, coverUrl?, coverDriveUrl?, fileUrl?, fileType? }`; `{ sentToProgramacao: boolean }`; `{ action: "send-internal" | "send-client" | "mark-published" }`. Transições setam `ContentItem.status` e criam/resetam a review (propagando no grupo).
  - `DELETE /api/admin/posts/[itemId]` → exclui o post (grupo inteiro se carrossel).

- [ ] **Step 1: Criar a rota**

Create `src/app/api/admin/posts/[itemId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ids de todos os itens do "post" (grupo do carrossel, ou o próprio item)
async function postItemIds(itemId: string): Promise<string[]> {
  const item = await prisma.contentItem.findUnique({
    where: { id: itemId },
    select: { id: true, groupId: true, contentType: true },
  });
  if (!item) return [];
  if (item.contentType === "CARROSSEL" && item.groupId) {
    const slides = await prisma.contentItem.findMany({ where: { groupId: item.groupId }, select: { id: true } });
    return slides.map((s) => s.id);
  }
  return [item.id];
}

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const exists = await prisma.contentItem.findUnique({ where: { id: params.itemId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

  const body = await req.json();
  const { title, caption, scheduledDate, driveUrl, coverUrl, coverDriveUrl, fileUrl, fileType, sentToProgramacao, action } = body;

  try {
    // 1) Edições de campos no item clicado
    await prisma.contentItem.update({
      where: { id: params.itemId },
      data: {
        ...(title !== undefined && { title: title || null }),
        ...(caption !== undefined && { caption: caption || null }),
        ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(`${scheduledDate}T12:00:00.000Z`) : null }),
        ...(driveUrl !== undefined && { driveUrl: driveUrl || null }),
        ...(coverUrl !== undefined && { coverUrl: coverUrl || null }),
        ...(coverDriveUrl !== undefined && { coverDriveUrl: coverDriveUrl || null }),
        ...(fileUrl !== undefined && { fileUrl }),
        ...(fileType !== undefined && { fileType }),
      },
    });

    const ids = await postItemIds(params.itemId);

    // Data e programação propagam ao grupo
    if (scheduledDate !== undefined) {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { scheduledDate: scheduledDate ? new Date(`${scheduledDate}T12:00:00.000Z`) : null } });
    }
    if (sentToProgramacao !== undefined) {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { sentToProgramacaoAt: sentToProgramacao ? new Date() : null } });
    }

    // 2) Transições de etapa (propagam ao grupo)
    if (action === "send-internal") {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "INTERNAL_REVIEW" } });
      for (const id of ids) {
        await prisma.internalReviewItem.upsert({
          where: { contentItemId: id },
          update: { status: "PENDING", comment: null, commentResolved: false, reviewedAt: null },
          create: { contentItemId: id, status: "PENDING" },
        });
      }
    } else if (action === "send-client") {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "CLIENT_REVIEW", sentToProgramacaoAt: null } });
      for (const id of ids) {
        await prisma.approvalItem.upsert({
          where: { contentItemId: id },
          update: { status: "PENDING", clientComment: null, clientCommentResolved: false, reviewedAt: null },
          create: { contentItemId: id, status: "PENDING" },
        });
      }
    } else if (action === "mark-published") {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "PUBLISHED", postedAt: new Date() } });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar post" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const ids = await postItemIds(params.itemId);
  if (ids.length === 0) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

  try {
    await prisma.contentItem.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir post" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` (zero erros) e `npm run build` (sucesso; rotas `/api/admin/clients/[id]/items` e `/api/admin/posts/[itemId]` compilam).

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/posts/[itemId]/route.ts"
git commit -m "feat(fase3.1): PATCH/DELETE /api/admin/posts/[itemId] (edit + stage transitions)"
```

---

## Task 3: Verificação (simulação das transições no banco, reversível)

**Files:** nenhuma.

Rotas admin são auth-gated (sessão NextAuth); a verificação runtime end-to-end acontece na 3.2 (UI logada). Aqui, confirmar a **lógica de transição** simulando as mesmas operações Prisma sobre um post real e revertendo.

- [ ] **Step 1: Simular a sequência de transições e conferir**

Rodar um script `.mjs` que: salva o estado original de um post de teste; aplica `DRAFT → send-internal (status=INTERNAL_REVIEW, InternalReviewItem PENDING) → aprovar interno (INTERNAL_DONE) → send-client (CLIENT_REVIEW, ApprovalItem PENDING) → aprovar cliente (APPROVED) → mark-published (PUBLISHED, postedAt)`, imprimindo `status` + status das reviews em cada passo; **depois reverte** o post ao estado salvo. Confirmar que cada passo bate e a reversão restaura.

- [ ] **Step 2: Registrar resultados.** (Sem commit.)

---

## Self-Review (feito na escrita)

- **Cobertura:** criar post no cliente (Task 1); transições por post com propagação de carrossel + reset no reenvio (Task 2); verificação da lógica (Task 3). ✅
- **Reset no reenvio** (item deferido da Fase 2): `send-client`/`send-internal` resetam a review anterior para PENDING. ✅
- **Aditivo:** rotas novas; nenhuma rota/coluna existente alterada. ✅
- **Carrossel:** `postItemIds` resolve o grupo; transições/data/programação/exclusão usam `updateMany` sobre o grupo. ✅
- **Auth:** `getServerSession(authOptions)` em todos os handlers (confirmar nome de `authOptions` em `@/lib/auth` na Task 1 Step 1). ✅
- **Sem placeholders / código completo.** ✅

## Próximas sub-fases (não implementar aqui)

- 3.2: Workspace do cliente (`/admin/clients/[id]` por status; upload no cliente via FolderUploadModal adaptado a `clientId`; copiar links do cliente).
- 3.3: Dashboard novo (por etapa, entre clientes).
- 3.4: Notificações (mail/whatsapp) + cron apontando para `/aprovar/[client.token]`; navegação.
