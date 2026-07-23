# Fase 3.2 — Workspace do cliente (posts por status) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `/admin/clients/[id]` no workspace principal por post: adicionar posts direto no cliente, ver os posts **agrupados por status**, e mover cada post de etapa (revisão interna → cliente → programação → publicado) — usando a API da 3.1. Esconder o fluxo antigo de "Nova Campanha".

**Architecture:** O GET `/api/admin/clients/[id]` passa a retornar os posts do cliente (`contentItems` por `clientId`, com `approvalItem`/`internalReviewItem`) + os tokens do cliente. A página reagrupa por `status` e por carrossel (`groupId`), renderiza cards com ações que chamam a API da 3.1 (`/api/admin/posts/[itemId]` e upload em `/api/admin/clients/[id]/items`). O `FolderUploadModal` ganha um modo client-scoped.

**Tech Stack:** Next.js 14, React (client component), Prisma, TypeScript, Tailwind.

## Global Constraints

- **Deploy bundlado** (deploy do pacote 2+3.1+3.2 após esta fase verificar).
- Reusar componentes/estilos existentes (CarouselCard, CopyButton, tema escuro, labels pt-BR).
- **Não criar campanha** nesta tela; remover o botão/modal "Nova Campanha".
- Status do post ∈ DRAFT | INTERNAL_REVIEW | INTERNAL_DONE | CLIENT_REVIEW | APPROVED | PUBLISHED. Carrossel = 1 post (representado pelo 1º slide por `order`).
- Ações usam a API da 3.1: `PATCH /api/admin/posts/[itemId]` com `{action}`/edições/`sentToProgramacao`; `DELETE /api/admin/posts/[itemId]`; upload → `POST /api/admin/clients/[id]/items`.
- Sem testes automatizados — `npx tsc --noEmit` + `npm run build` + verificação logada. **NÃO** `npm run lint`.
- `@` → `src/`.

---

## File Structure

- `src/app/api/admin/clients/[id]/route.ts` — **modificar** GET (retornar posts do cliente + tokens).
- `src/components/admin/FolderUploadModal.tsx` — **modificar** (aceitar `clientId`, postar no endpoint do cliente).
- `src/app/admin/(protected)/clients/[id]/page.tsx` — **reescrever** (workspace por status).

---

## Task 1: GET `/api/admin/clients/[id]` retorna posts + tokens

**Files:**
- Modify: `src/app/api/admin/clients/[id]/route.ts` (apenas o GET)

**Interfaces:**
- Produces: `GET /api/admin/clients/[id]` → `{ id, name, email, whatsapp, token, internalToken, contentItems: ContentItem[] }` onde cada `ContentItem` traz `{ id, fileUrl, fileType, title, caption, scheduledDate, contentType, groupId, driveUrl, coverUrl, coverDriveUrl, order, status, sentToProgramacaoAt, approvalItem:{status,clientComment}, internalReviewItem:{status,comment} }`, ordenado por `order asc`. (Manter `campaigns` no retorno se outras telas usarem; adicionar `contentItems` e os tokens é aditivo.)

- [ ] **Step 1: Ler o GET atual e adicionar `contentItems` + tokens ao retorno**

Abrir `src/app/api/admin/clients/[id]/route.ts`. No lookup do GET, garantir `token: true, internalToken: true` e:
```ts
contentItems: {
  orderBy: { order: "asc" },
  select: {
    id: true, fileUrl: true, fileType: true, title: true, caption: true, scheduledDate: true,
    contentType: true, groupId: true, driveUrl: true, coverUrl: true, coverDriveUrl: true,
    order: true, status: true, sentToProgramacaoAt: true,
    approvalItem: { select: { status: true, clientComment: true } },
    internalReviewItem: { select: { status: true, comment: true } },
  },
},
```
A relação `Client.contentItems` já existe no schema. Se o GET usa `select`, adicionar as chaves; se usa `include`, adicionar `contentItems`/tokens. Manter o resto do retorno.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/clients/[id]/route.ts"
git commit -m "feat(fase3.2): client GET returns per-client posts + tokens"
```

---

## Task 2: `FolderUploadModal` — modo client-scoped

**Files:**
- Modify: `src/components/admin/FolderUploadModal.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/clients/[id]/items` (3.1).
- Produces: prop opcional `clientId?: string`. Quando presente (e sem `campaignId`), cada slide vai via `POST /api/admin/clients/${clientId}/items` (mesmo body, sem `campaignId`). Com `campaignId`, comportamento atual (compat).

- [ ] **Step 1: Destino flexível**

Adicionar `clientId?: string` às props (manter `campaignId?: string`). No `handleSave`, definir `const endpoint = campaignId ? \`/api/admin/campaigns/${campaignId}/items\` : \`/api/admin/clients/${clientId}/items\`;` e usar `endpoint` no `fetch`. Body inalterado.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros. (Se `campaignId` era obrigatório nas props, torná-lo opcional; o call-site em `campaigns/[id]/page.tsx` que passa `campaignId` continua válido.)

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/FolderUploadModal.tsx
git commit -m "feat(fase3.2): FolderUploadModal supports client-scoped upload"
```

---

## Task 3: Reescrever `/admin/clients/[id]` como workspace por status

**Files:**
- Rewrite: `src/app/admin/(protected)/clients/[id]/page.tsx`

**Interfaces:**
- Consumes: GET da Task 1; `FolderUploadModal` (Task 2, com `clientId`); `PATCH`/`DELETE /api/admin/posts/[itemId]` (3.1); `CarouselCard`; `CopyButton`.

- [ ] **Step 1: Reescrever a página**

`"use client"`. Estrutura:
- `fetchClient()` → GET `/api/admin/clients/[id]`; estado `client` com `contentItems` (+ `token`, `internalToken`).
- **Header:** nome + e-mail/whatsapp; botões: **"+ Adicionar posts"** (abre `FolderUploadModal` com `clientId={id}` + `existingItemCount`), **"Copiar link do cliente"** (`${origin}/aprovar/${client.token}`), **"Copiar link revisão interna"** (`${origin}/revisar/${client.internalToken}`). **Remover "Nova Campanha".**
- **Agrupamento:** agrupar `contentItems` por carrossel (`contentType==="CARROSSEL" && groupId` → 1 post; senão single); representante = 1º slide por `order`; `status` = do representante.
- **Seções por status** (só as não-vazias), nesta ordem, cada uma com cabeçalho + contagem:
  `DRAFT`→"Rascunho"; `INTERNAL_REVIEW`→"Revisão interna"; `INTERNAL_DONE`→"Revisão interna concluída"; `CLIENT_REVIEW`→"Aguardando cliente"; `APPROVED`→"Aprovado"; `PUBLISHED`→"Publicado".
- **Card de post** (reusar visual do CarouselCard p/ carrossel, ou card simples p/ single): thumbnail, título, tipo, data agendada, legenda (line-clamp), badges de status + comentários (`internalReviewItem.comment` / `approvalItem.clientComment`), e **linha de ações** por status:
  - `DRAFT`: **Enviar p/ revisão interna** (`PATCH {action:"send-internal"}`), Editar, Excluir.
  - `INTERNAL_REVIEW`: se `internalReviewItem.status` ADJUSTMENT/REJECTED → **Ajuste feito** (`PATCH {action:"send-internal"}`) + comentário; Editar, Excluir.
  - `INTERNAL_DONE`: **Enviar p/ cliente** (`PATCH {action:"send-client"}`), Editar, Excluir.
  - `CLIENT_REVIEW`: se `approvalItem.status` ADJUSTMENT/REJECTED → **Ajuste feito** (`PATCH {action:"send-client"}`) + comentário; Editar, Excluir.
  - `APPROVED`: **→ Programação**/**Remover da Programação** (`PATCH {sentToProgramacao:bool}`), **Marcar publicado** (`PATCH {action:"mark-published"}`), Editar, Excluir; selo "Na Programação" se `sentToProgramacaoAt`.
  - `PUBLISHED`: badge "publicado"; Excluir.
  - Todas: **🔗 Link p/ designer** (copia `${origin}/post/${representanteId}`).
- **Editar** (modal): título, legenda, data, link do Drive, capa (Drive) → `PATCH /api/admin/posts/[itemId]`. **Excluir** → `DELETE /api/admin/posts/[itemId]` (confirm).
- Cada ação chama `fetchClient()` ao concluir. Estado "salvando" por post.
- Estados: "Carregando...", "Cliente não encontrado".

(Reaproveitar padrões do antigo `campaigns/[id]/page.tsx` — grouping, edit modal, CarouselCard — adaptando as chamadas para a API da 3.1 e o agrupamento por status. Não reintroduzir campanha/mês/cobrança.)

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` (zero erros) e `npm run build` (sucesso; `/admin/clients/[id]` compila).

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/(protected)/clients/[id]/page.tsx"
git commit -m "feat(fase3.2): client workspace by status (create/move posts, links)"
```

---

## Task 4: Verificação logada + esconder entrada antiga

**Files:** possivelmente `AdminNav.tsx` / `clients/page.tsx` (esconder acesso ao campaign workspace na navegação principal, se houver).

- [ ] **Step 1: Build + dev logado**

`npm run build` OK; subir dev (workarounds); logar em `/admin/login` (`ADMIN_USERNAME/ADMIN_PASSWORD` do `.env`); abrir `/admin/clients/[id]` de um cliente com posts em vários status.

- [ ] **Step 2: Fluxo manual (reversível onde der)**

Adicionar posts (upload Drive) cria DRAFT no cliente; enviar p/ revisão interna → aparece no link interno; enviar p/ cliente → aparece no link do cliente; → Programação e Marcar publicado; editar/excluir; copiar os 2 links. Reverter mutações de teste via Prisma quando fizer sentido.

- [ ] **Step 3: Esconder criação de campanha**

Confirmar que não há mais "Nova Campanha" nesta tela. (A tela `/admin/campaigns/[id]` continua existindo até a Fase 4, mas deixa de ser a porta de entrada.)

- [ ] **Step 4: Registrar resultados.**

---

## Self-Review (feito na escrita)

- **Cobertura:** GET com posts+tokens (T1); upload no cliente (T2); workspace por status com as ações da 3.1 (T3); verificação logada + esconder campanha (T4). ✅
- **Reusa 3.1:** transições via `/api/admin/posts/[itemId]`; upload via `/api/admin/clients/[id]/items`. ✅
- **Sem campanha/mês/cobrança** na tela nova. ✅
- **Carrossel:** agrupado por `groupId`; ações no representante propagam no backend (3.1). ✅
- Nota: a Task 3 é um arquivo de UI grande e novo; descrita em detalhe (estrutura + chamadas exatas de API) em vez de 100% verbatim, reaproveitando padrões existentes.

## Próximas
- 3.3 dashboard por etapa · 3.4 notificações/nav · 4 programação/planner + limpeza. **Deploy do pacote após 3.2 verificar.**
