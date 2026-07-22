# Fase 2 — Links públicos por cliente (evergreen) + redirect legado — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer `/aprovar/[token]` e `/revisar/[token]` funcionarem por **token de cliente** (evergreen), mostrando os posts do cliente na etapa certa (`CLIENT_REVIEW` / `INTERNAL_REVIEW`), com aprovar/ajustar por post que move o `status` do post; e **redirecionar** os links legados (token de campanha) para o link novo do cliente.

**Architecture:** As rotas de API resolvem o token: se bate com `Client.token`/`Client.internalToken` → modo novo (posts por status). Se bate com `Campaign.token`/`Campaign.internalToken` → legado → devolve `{ redirect: <clientToken> }` e a página faz `router.replace`. O PATCH seta `ApprovalItem`/`InternalReviewItem` **e** o `ContentItem.status`, sem auto-close de campanha. As páginas mudam pouco: tratar redirect + estado vazio evergreen.

**Tech Stack:** Next.js 14 App Router, React, Prisma, TypeScript.

## Global Constraints

- **Deploy é bundlado** (Fases 2–4 sobem juntas quando prontas). Nesta fase, commit local; não precisa ir ao ar sozinha.
- **Token novo = cliente**; token de campanha = **legado → redirect**. Resolução por lookup no banco (Client primeiro, Campaign depois, senão 404).
- **PATCH move o `status` do post:** aprovar cliente → `APPROVED`; aprovar interno → `INTERNAL_DONE`; ajuste/reprovação → mantém na etapa (`CLIENT_REVIEW`/`INTERNAL_REVIEW`). **Sem auto-close/auto-transition de campanha.**
- **IDOR:** PATCH só aceita item cujo `clientId` bate com o cliente do token.
- Carrossel: uma decisão vale para o grupo inteiro (a página já faz PATCH por slide; o status do post é setado em cada slide do grupo).
- Endpoints batch obsoletos (`approval/[token]/submit`, `internal/[token]/submit`, `internal/[token]/send-client`) **não são tocados** aqui (limpeza na Fase 4); as páginas deixam de chamá-los.
- Sem testes automatizados — verificar com `npx tsc --noEmit`, `npm run build` e teste local via HTTP/navegador. **NÃO** `npm run lint`.
- Tema/labels atuais preservados. `@` → `src/`.

---

## File Structure

- `src/app/api/approval/[token]/route.ts` — **reescrever** GET+PATCH (cliente/legado; status por post).
- `src/app/aprovar/[token]/page.tsx` — **modificar** (redirect + estado vazio evergreen).
- `src/app/api/internal/[token]/route.ts` — **reescrever** GET+PATCH (cliente/legado; status por post).
- `src/app/revisar/[token]/page.tsx` — **modificar** (redirect + estado vazio evergreen; remover finalizar/enviar-cliente batch).

---

## Task 1: API de aprovação do cliente (GET+PATCH por cliente, redirect legado)

**Files:**
- Modify: `src/app/api/approval/[token]/route.ts` (reescrita completa)

**Interfaces:**
- Produces:
  - `GET /api/approval/[token]` →
    - token = `Client.token`: `{ id, name, token, status:"OPEN", client:{name}, contentItems: [posts CLIENT_REVIEW do cliente] }` (shape compatível com a página atual; `contentItems` com `{id,fileUrl,fileType,caption,scheduledDate,contentType,groupId,coverUrl,driveUrl,approvalItem:{status,clientComment}}`).
    - token = `Campaign.token` (legado): `{ redirect: <client.token do dono da campanha> }`, HTTP 200.
    - senão: 404 `{ error: "Link não encontrado" }`.
  - `PATCH /api/approval/[token]` (token de cliente) body `{ contentItemId, status, clientComment? }` → upsert `ApprovalItem` + set `ContentItem.status`. 404 se token não for de cliente ou item não pertencer ao cliente.

- [ ] **Step 1: Reescrever a rota**

Substituir o conteúdo de `src/app/api/approval/[token]/route.ts` por:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const POST_SELECT = {
  id: true, fileUrl: true, fileType: true, contentType: true, title: true, caption: true,
  scheduledDate: true, groupId: true, order: true, coverUrl: true, driveUrl: true,
  approvalItem: { select: { status: true, clientComment: true } },
} as const;

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    // Novo: token de cliente
    const client = await prisma.client.findUnique({ where: { token: params.token }, select: { id: true, name: true, token: true } });
    if (client) {
      const contentItems = await prisma.contentItem.findMany({
        where: { clientId: client.id, status: "CLIENT_REVIEW" },
        orderBy: { order: "asc" },
        select: POST_SELECT,
      });
      return NextResponse.json({ id: client.id, name: client.name, token: client.token, status: "OPEN", client: { name: client.name }, contentItems });
    }
    // Legado: token de campanha → redireciona pro link do cliente
    const campaign = await prisma.campaign.findUnique({ where: { token: params.token }, select: { client: { select: { token: true } } } });
    if (campaign?.client?.token) {
      return NextResponse.json({ redirect: campaign.client.token });
    }
    return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar aprovação" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const client = await prisma.client.findUnique({ where: { token: params.token }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });

  const body = await req.json();
  const { contentItemId, status, clientComment } = body;
  const VALID = ["APPROVED", "ADJUSTMENT", "REJECTED"];
  if (!contentItemId || !status || !VALID.includes(status)) {
    return NextResponse.json({ error: "Campos obrigatórios faltando ou inválidos" }, { status: 400 });
  }

  // IDOR: item precisa ser do cliente do token
  const item = await prisma.contentItem.findFirst({ where: { id: contentItemId, clientId: client.id }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  try {
    await prisma.approvalItem.upsert({
      where: { contentItemId },
      update: { status, clientComment: clientComment || null, clientCommentResolved: false, reviewedAt: new Date() },
      create: { contentItemId, status, clientComment: clientComment || null, clientCommentResolved: false, reviewedAt: new Date() },
    });
    // Move o status do post: aprovado sai do link; ajuste/reprovação continua em CLIENT_REVIEW
    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { status: status === "APPROVED" ? "APPROVED" : "CLIENT_REVIEW" },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar avaliação" }, { status: 500 });
  }
}
```

Nota: `ApprovalItem.campaignId` era obrigatório antes; no upsert `create` acima ele é omitido. **Pré-requisito:** `ApprovalItem.campaignId` precisa ser nullable no schema (ver Step 2).

- [ ] **Step 2: Garantir `ApprovalItem.campaignId` nullable (SQL + schema)**

Rodar:
```bash
node --input-type=module -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); await p.\$executeRawUnsafe('ALTER TABLE \"ApprovalItem\" ALTER COLUMN \"campaignId\" DROP NOT NULL'); console.log('ok'); await p.\$disconnect();"
```
E em `prisma/schema.prisma`, no model `ApprovalItem`: trocar `campaignId String` por `campaignId String?` e a relação `campaign Campaign @relation(...)` por `campaign Campaign? @relation(...)`. Rodar `npx prisma generate`.
Expected: `ok`; generate sem erro.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/approval/[token]/route.ts" prisma/schema.prisma
git commit -m "feat(fase2): client-token approval API (per-post status) + legacy redirect"
```

---

## Task 2: Página `/aprovar/[token]` — redirect + estado vazio evergreen

**Files:**
- Modify: `src/app/aprovar/[token]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/approval/[token]` (Task 1), incluindo o caso `{ redirect }`.

- [ ] **Step 1: Tratar redirect e remover o gate de CLOSED**

Em `src/app/aprovar/[token]/page.tsx`:
- Na linha 4, `import { useParams, useRouter } from "next/navigation";` e no componente adicionar `const router = useRouter();`.
- Na `fetchCampaign` (linha ~70), trocar o trecho de parse por:
```ts
    const res = await fetch(`/api/approval/${token}`);
    if (res.status === 404) { setError("not_found"); setLoading(false); return; }
    const data = await res.json();
    if (data.redirect) { router.replace(`/aprovar/${data.redirect}`); return; }
    setCampaign(data);
```
(Remover a linha `if (data.status === "CLOSED") { setError("closed"); setLoading(false); return; }`.)

- [ ] **Step 2: Estado vazio evergreen (nada pendente)**

Após o carregamento, se `campaign && groups.length === 0`, renderizar a tela "tudo em dia" (adicionar antes do render principal, junto dos outros early-returns de `loading`/`error`):
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
(O ramo `error === "closed"` deixa de ocorrer; pode deixá-lo inofensivo.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add "src/app/aprovar/[token]/page.tsx"
git commit -m "feat(fase2): client approval page — redirect legacy + evergreen empty state"
```

---

## Task 3: API de revisão interna (GET+PATCH por cliente, redirect legado)

**Files:**
- Modify: `src/app/api/internal/[token]/route.ts` (reescrita de GET+PATCH)

**Interfaces:**
- Produces:
  - `GET /api/internal/[token]` → token = `Client.internalToken`: `{ id, name, token:<client.token>, internalToken, status:"INTERNAL_REVIEW", client:{name}, contentItems:[posts INTERNAL_REVIEW] }` (com `internalReviewItem:{status,comment}`, `coverDriveUrl`, `driveUrl`). Legado (`Campaign.internalToken`) → `{ redirect: <client.internalToken> }`. Senão 404.
  - `PATCH /api/internal/[token]` body `{ contentItemId, status, comment? }` → upsert `InternalReviewItem` + set `ContentItem.status` (`APPROVED` interno → `INTERNAL_DONE`; ajuste/reprovação → `INTERNAL_REVIEW`). IDOR por cliente.

- [ ] **Step 1: Reescrever a rota**

Substituir o conteúdo de `src/app/api/internal/[token]/route.ts` por:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const POST_SELECT = {
  id: true, fileUrl: true, fileType: true, contentType: true, title: true, caption: true,
  scheduledDate: true, groupId: true, order: true, coverUrl: true, coverDriveUrl: true, driveUrl: true,
  internalReviewItem: { select: { status: true, comment: true } },
} as const;

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const client = await prisma.client.findUnique({ where: { internalToken: params.token }, select: { id: true, name: true, token: true, internalToken: true } });
    if (client) {
      const contentItems = await prisma.contentItem.findMany({
        where: { clientId: client.id, status: "INTERNAL_REVIEW" },
        orderBy: { order: "asc" },
        select: POST_SELECT,
      });
      return NextResponse.json({ id: client.id, name: client.name, token: client.token, internalToken: client.internalToken, status: "INTERNAL_REVIEW", client: { name: client.name }, contentItems });
    }
    const campaign = await prisma.campaign.findUnique({ where: { internalToken: params.token }, select: { client: { select: { internalToken: true } } } });
    if (campaign?.client?.internalToken) {
      return NextResponse.json({ redirect: campaign.client.internalToken });
    }
    return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar revisão" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const client = await prisma.client.findUnique({ where: { internalToken: params.token }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });

  const body = await req.json();
  const { contentItemId, status, comment } = body;
  const VALID = ["APPROVED", "ADJUSTMENT", "REJECTED"];
  if (!contentItemId || !status || !VALID.includes(status)) {
    return NextResponse.json({ error: "Campos obrigatórios faltando ou inválidos" }, { status: 400 });
  }

  const item = await prisma.contentItem.findFirst({ where: { id: contentItemId, clientId: client.id }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  try {
    await prisma.internalReviewItem.upsert({
      where: { contentItemId },
      update: { status, comment: comment || null, commentResolved: false, reviewedAt: new Date() },
      create: { contentItemId, status, comment: comment || null, commentResolved: false, reviewedAt: new Date() },
    });
    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { status: status === "APPROVED" ? "INTERNAL_DONE" : "INTERNAL_REVIEW" },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar revisão" }, { status: 500 });
  }
}
```

**Pré-requisito:** `InternalReviewItem.campaignId` nullable (mesmo padrão do Task 1 Step 2):
```bash
node --input-type=module -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); await p.\$executeRawUnsafe('ALTER TABLE \"InternalReviewItem\" ALTER COLUMN \"campaignId\" DROP NOT NULL'); console.log('ok'); await p.\$disconnect();"
```
E schema `InternalReviewItem.campaignId String?` + `campaign Campaign?`. `npx prisma generate`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/internal/[token]/route.ts" prisma/schema.prisma
git commit -m "feat(fase2): client-internalToken review API (per-post status) + legacy redirect"
```

---

## Task 4: Página `/revisar/[token]` — redirect + estado vazio + tirar finalizar/enviar batch

**Files:**
- Modify: `src/app/revisar/[token]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/internal/[token]` (Task 3), incluindo `{ redirect }`.

- [ ] **Step 1: Tratar redirect e remover gates de campanha**

Em `src/app/revisar/[token]/page.tsx`, na função de fetch (a que faz `fetch('/api/internal/...')`):
- Usar `useRouter` (`import { useParams, useRouter } from "next/navigation"` + `const router = useRouter()`).
- Após `await res.json()`: `if (data.redirect) { router.replace('/revisar/' + data.redirect); return; }`.
- Remover qualquer gate de `campaign.status` que bloqueie a UI — evergreen mostra sempre os `INTERNAL_REVIEW`.

- [ ] **Step 2: Estado vazio evergreen**

Se, após carregar, `groups.length === 0`, renderizar a tela "nada pendente":
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
(Usar o nome de estado que a página já usa para o objeto carregado no lugar de `campaign`, se for diferente.)

- [ ] **Step 3: Remover o batch "Finalizar Revisão Interna" e "enviar para o cliente"**

No modelo evergreen a revisão é por post (aprovar cada post já o move para `INTERNAL_DONE`). Remover da página: o botão sticky **"Finalizar Revisão Interna"** (chamada `POST /api/internal/[token]/submit`), a tela de resultado pós-submit, e o painel **"Copiar mensagem e enviar para o cliente"** (chamada `POST .../send-client`). O envio ao cliente passa a ser ação do admin (Fase 3). Manter apenas as ações por post (Aprovar/Ajuste/Reprovar) que já fazem PATCH.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit` (zero erros) e `npm run build` (sucesso; rotas `/aprovar/[token]`, `/revisar/[token]`, `/api/approval/[token]`, `/api/internal/[token]` compilam).

- [ ] **Step 5: Commit**

```bash
git add "src/app/revisar/[token]/page.tsx"
git commit -m "feat(fase2): internal review page — redirect + evergreen + drop batch finalize"
```

---

## Task 5: Verificação end-to-end (local, reversível)

**Files:** nenhuma (verificação).

- [ ] **Step 1: Subir o dev server** (workarounds conhecidos: parar node/next, `Remove-Item -Recurse -Force .next`, `NEXTAUTH_URL="http://localhost:3000" npm run dev` em background; esperar "Ready").

- [ ] **Step 2: Pegar tokens reais e testar (endpoints públicos)**

Via Prisma, pegar um `client.token`/`client.internalToken` de um cliente com posts em `CLIENT_REVIEW`/`INTERNAL_REVIEW`, e um `campaign.token`/`campaign.internalToken` legado do mesmo cliente. Então:
- `GET /api/approval/<clientToken>` → 200 com `contentItems` (CLIENT_REVIEW).
- `GET /api/approval/<campaignToken>` → 200 `{ redirect: <clientToken> }`.
- `GET /api/approval/<inexistente>` → 404.
- `GET /api/internal/<clientInternalToken>` → 200 (INTERNAL_REVIEW); `GET /api/internal/<campaignInternalToken>` → `{ redirect }`.
- Páginas `/aprovar/<clientToken>` e `/revisar/<clientInternalToken>` → 200.

- [ ] **Step 3: Testar PATCH (reversível)**

Post CLIENT_REVIEW → `PATCH /api/approval/<clientToken>` `{ contentItemId, status:"APPROVED" }` → `success`; re-`GET` → post sumiu; conferir `ContentItem.status = APPROVED`. **Reverter**: `status` → `CLIENT_REVIEW` e `ApprovalItem.status` → `PENDING` via Prisma. IDOR: `PATCH` com `contentItemId` de outro cliente → 404.

- [ ] **Step 4: Parar o dev server e registrar resultados.**

---

## Self-Review (feito na escrita)

- **Cobertura da spec (Fase 2):** GET/PATCH por cliente com status por post (Tasks 1,3); redirect legado (Tasks 1,3); páginas evergreen (Tasks 2,4); verificação (Task 5). ✅
- **Sem auto-close/transition de campanha:** removidos das rotas reescritas. ✅
- **IDOR:** PATCH valida `clientId` do item. ✅
- **Consistência de tipos:** GET devolve shape compatível com as interfaces das páginas; PATCH mantém o body que as páginas já enviam. ✅
- **Pré-requisito de schema:** `ApprovalItem.campaignId`/`InternalReviewItem.campaignId` viram nullable (upsert `create` os omite). ✅
- **Sem placeholders** (API completa; páginas com edições pontuais e snippets exatos). ✅

## Próximas fases

- Fase 3: admin (workspace do cliente por status; enviar p/ revisão / p/ cliente por post; dashboard; notificações repontando pros links do cliente).
- Fase 4: Programação/Planner no novo modelo + limpeza (remover batch endpoints, cobrança, restos de campanha).
