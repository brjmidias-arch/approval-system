# Integração Aprovação ↔ Roteirização — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No approval-system, anexar cada post à peça correspondente do Roteirização, puxar o texto do roteiro e sincronizar (one-way) o status da peça conforme as fases da aprovação.

**Architecture:** Bancos Supabase separados. O aprovação acessa o banco do Roteirização (`kyxwmvgxufjwkiyodsgd`) via um Supabase client com **service role** (server-only) em `src/lib/roteirizacao.ts`. Vínculo por peça: `ContentItem.roteiroConteudoId` → `rot_conteudos.id`; cliente↔cliente via `Client.roteiroClienteId` → `rot_clientes.id`. Sync de status é best-effort e nunca quebra a ação da aprovação.

**Tech Stack:** Next.js 14 (App Router), Prisma, Supabase (`@supabase/supabase-js` — já usado em `src/lib/supabase.ts`), TypeScript.

## Global Constraints

- **Sem framework de testes.** Verificar cada tarefa com `npx tsc --noEmit` e `npm run build` (limpar `.next` antes por causa do lock do OneDrive). Nunca `npm run lint`.
- **Banco do aprovação:** Supabase pooler em session mode (5432, ~15 conexões). NÃO disparar Prisma/Supabase em paralelo; ações em lote são sequenciais.
- **Deploy:** `git push origin main` → Vercel. Env de produção é editado pelo usuário no painel da Vercel.
- **Service role do Roteirização** é secreto: só em env server do aprovação; toda chamada ao Roteirização é server-side. Nunca logar a chave.
- **Roteirização é read/write mínimo:** só lemos `rot_clientes`/`rot_conteudos` e escrevemos **apenas** `rot_conteudos.status`. Não alterar schema nem app do Roteirização.
- **`rot_conteudos.status` válido:** `pendente | aprovado | ajuste | regenerando`. Só gravamos `aprovado` ou `ajuste`.
- Componentes interativos usam `"use client"`; páginas que buscam dados usam `export const dynamic = "force-dynamic"`. Alias `@` → `src/`.

---

## Pré-requisito (setup — bloqueia início)

**Feito pelo usuário + verificado:**
- Usuário pega a **service role key** do projeto Roteirização (Supabase → Settings → API) e adiciona ao `.env` local do aprovação e ao env da Vercel:
  - `ROTEIRIZACAO_SUPABASE_URL="https://kyxwmvgxufjwkiyodsgd.supabase.co"`
  - `ROTEIRIZACAO_SUPABASE_SERVICE_ROLE_KEY="<service role>"`
- Sem essas vars, a Fase A não roda. As tarefas assumem que já estão no `.env` local.

---

## File Structure

- `src/lib/roteirizacao.ts` — **novo**. Client Supabase do Roteirização + funções `listClientesRot()`, `listConteudosDoCliente(rotClienteId)`, `getConteudo(id)`, `setConteudoStatus(id, status)`. Server-only.
- `src/lib/syncRoteiro.ts` — **novo** (Fase C). Helper `syncRoteiroStatus(contentItemId)`.
- `prisma/schema.prisma` — **modificar**. `Client.roteiroClienteId`, `ContentItem.roteiroConteudoId`.
- `src/app/api/admin/roteirizacao/clientes/route.ts` — **novo** (Fase A). GET lista `rot_clientes` (para o vínculo).
- `src/app/api/admin/clients/[id]/route.ts` — **modificar** (Fase A). PATCH aceita `roteiroClienteId`.
- `src/app/api/admin/roteirizacao/conteudos/route.ts` — **novo** (Fase B). GET lista `rot_conteudos` do cliente vinculado.
- `src/app/api/admin/posts/[itemId]/route.ts` — **modificar** (Fase B: aceitar `roteiroConteudoId`; Fase C: chamar sync).
- `src/app/api/internal/[token]/route.ts` — **modificar** (Fase C). chamar sync.
- `src/app/api/approval/[token]/route.ts` — **modificar** (Fase C). chamar sync.
- `src/app/admin/(protected)/clients/[id]/page.tsx` — **modificar** (Fase A: UI de vínculo cliente; Fase B: picker "Anexar roteiro").
- `scripts/diag-roteirizacao.mjs` — **novo temporário**. Script read-only para validar conexão cross-project.

---

## Fase A — Fundação

### Task A1: Client de acesso ao Roteirização + validação de leitura

**Files:**
- Create: `src/lib/roteirizacao.ts`
- Create (temp): `scripts/diag-roteirizacao.mjs`

**Interfaces:**
- Produces:
  - `listClientesRot(): Promise<{ id: string; nome: string }[]>`
  - `listConteudosDoCliente(rotClienteId: string): Promise<RotConteudo[]>`
  - `getConteudo(id: string): Promise<RotConteudo | null>`
  - `setConteudoStatus(id: string, status: "aprovado" | "ajuste"): Promise<void>`
  - `type RotConteudo = { id: string; roteiro_id: string; tipo: string; titulo: string | null; legenda: string | null; status: string }`

- [ ] **Step 1: Criar `src/lib/roteirizacao.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.ROTEIRIZACAO_SUPABASE_URL;
const key = process.env.ROTEIRIZACAO_SUPABASE_SERVICE_ROLE_KEY;

/** Client do Supabase do Roteirização (service role, SÓ servidor). */
function rot() {
  if (!url || !key) throw new Error("ROTEIRIZACAO_SUPABASE_URL/KEY não configurados");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type RotConteudo = {
  id: string;
  roteiro_id: string;
  tipo: string;
  titulo: string | null;
  legenda: string | null;
  status: string;
};

export async function listClientesRot(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await rot().from("rot_clientes").select("id, nome").order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function listConteudosDoCliente(rotClienteId: string): Promise<RotConteudo[]> {
  // rot_conteudos -> rot_roteiros(cliente_id). Filtra pelos roteiros do cliente.
  const { data: roteiros, error: e1 } = await rot()
    .from("rot_roteiros").select("id").eq("cliente_id", rotClienteId);
  if (e1) throw e1;
  const ids = (roteiros ?? []).map((r) => r.id);
  if (ids.length === 0) return [];
  const { data, error } = await rot()
    .from("rot_conteudos")
    .select("id, roteiro_id, tipo, titulo, legenda, status")
    .in("roteiro_id", ids)
    .order("ordem");
  if (error) throw error;
  return data ?? [];
}

export async function getConteudo(id: string): Promise<RotConteudo | null> {
  const { data, error } = await rot()
    .from("rot_conteudos")
    .select("id, roteiro_id, tipo, titulo, legenda, status")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function setConteudoStatus(id: string, status: "aprovado" | "ajuste"): Promise<void> {
  const { error } = await rot().from("rot_conteudos").update({ status }).eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 2: Criar `scripts/diag-roteirizacao.mjs` (read-only)**

```js
import { createClient } from "@supabase/supabase-js";
const rot = createClient(process.env.ROTEIRIZACAO_SUPABASE_URL, process.env.ROTEIRIZACAO_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: clientes, error } = await rot.from("rot_clientes").select("id, nome").order("nome");
if (error) { console.error("FAIL:", error); process.exit(1); }
console.log("rot_clientes:", clientes.length, clientes.slice(0, 5));
const { data: conteudos } = await rot.from("rot_conteudos").select("id, titulo, status").limit(3);
console.log("sample rot_conteudos:", conteudos);
```

- [ ] **Step 3: Rodar o diagnóstico (valida conexão + service role + schema)**

Run: `node scripts/diag-roteirizacao.mjs`
Expected: imprime a contagem de `rot_clientes` e 3 conteúdos de amostra (sem erro). Se der erro de auth → a service role está errada.

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roteirizacao.ts scripts/diag-roteirizacao.mjs
git commit -m "feat(roteirizacao): client cross-project + funcoes de leitura/status"
```

### Task A2: Campo `Client.roteiroClienteId` (Prisma)

**Files:**
- Modify: `prisma/schema.prisma` (model Client)

**Interfaces:**
- Produces: `Client.roteiroClienteId: string | null` disponível no Prisma Client.

- [ ] **Step 1: Adicionar o campo no model Client**

Em `prisma/schema.prisma`, dentro de `model Client`, após `internalToken`:

```prisma
  roteiroClienteId String?
```

- [ ] **Step 2: Migration**

Run: `npx prisma migrate dev --name add_client_roteiro_cliente_id`
Expected: cria a migration e aplica no banco (usa DIRECT_URL). Prisma Client regenerado.

- [ ] **Step 3: tsc + build**

Run: `npx tsc --noEmit` então (limpar `.next`) `npm run build`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): Client.roteiroClienteId (vinculo cliente x roteirizacao)"
```

### Task A3: API + UI para vincular cliente↔cliente

**Files:**
- Create: `src/app/api/admin/roteirizacao/clientes/route.ts`
- Modify: `src/app/api/admin/clients/[id]/route.ts` (PATCH aceitar `roteiroClienteId`)
- Modify: `src/app/admin/(protected)/clients/[id]/page.tsx` (controle de vínculo)

**Interfaces:**
- Consumes: `listClientesRot()` (Task A1).
- Produces: rota `GET /api/admin/roteirizacao/clientes` → `{ id, nome }[]`; PATCH do cliente grava `roteiroClienteId`.

- [ ] **Step 1: Rota que lista rot_clientes (protegida por sessão)**

Create `src/app/api/admin/roteirizacao/clientes/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listClientesRot } from "@/lib/roteirizacao";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    return NextResponse.json({ clientes: await listClientesRot() });
  } catch {
    return NextResponse.json({ error: "Roteirização indisponível" }, { status: 502 });
  }
}
```

- [ ] **Step 2: PATCH do cliente aceitar `roteiroClienteId`**

Em `src/app/api/admin/clients/[id]/route.ts`, no handler PATCH, adicionar `roteiroClienteId` ao destructuring do body e ao `data` do update:

```ts
// no body:
const { /* ...campos existentes..., */ roteiroClienteId } = body;
// no data do update:
...(roteiroClienteId !== undefined && { roteiroClienteId: roteiroClienteId || null }),
```

(Ler o arquivo antes; seguir o padrão dos outros campos.)

- [ ] **Step 3: UI de vínculo na página do cliente**

Em `src/app/admin/(protected)/clients/[id]/page.tsx`, adicionar um bloco "Vincular ao Roteirização": um `<select>` populado por `GET /api/admin/roteirizacao/clientes` (com opção sugerida por nome ≈ nome do cliente), que ao salvar faz `PATCH /api/admin/clients/[id]` com `roteiroClienteId`. Seguir o padrão de fetch/estado já usado no arquivo (`"use client"`). Mostrar aviso se a rota retornar 502.

- [ ] **Step 4: Verificar (logado)**

Run: `npx tsc --noEmit` + build. Depois, com o dev logado, abrir a página do cliente, ver a lista do Roteirização carregar e salvar o vínculo (confere no banco do aprovação que `roteiroClienteId` gravou).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/roteirizacao/clientes/route.ts" "src/app/api/admin/clients/[id]/route.ts" "src/app/admin/(protected)/clients/[id]/page.tsx"
git commit -m "feat(roteirizacao): vincular cliente do aprovacao ao rot_clientes"
```

---

## Fase B — Anexar + preencher

### Task B1: Campo `ContentItem.roteiroConteudoId` (Prisma)

**Files:**
- Modify: `prisma/schema.prisma` (model ContentItem)

- [ ] **Step 1: Adicionar campo**

Em `model ContentItem`, adicionar:

```prisma
  roteiroConteudoId String?
```

- [ ] **Step 2: Migration**

Run: `npx prisma migrate dev --name add_contentitem_roteiro_conteudo_id`

- [ ] **Step 3: tsc + build**; **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): ContentItem.roteiroConteudoId (post x peca roteiro)"
```

### Task B2: Rota que lista conteúdos do cliente vinculado

**Files:**
- Create: `src/app/api/admin/roteirizacao/conteudos/route.ts`

**Interfaces:**
- Consumes: `listConteudosDoCliente` (A1); `Client.roteiroClienteId` (A2).
- Produces: `GET /api/admin/roteirizacao/conteudos?clientId=<approvalClientId>` → `{ conteudos: RotConteudo[] }`.

- [ ] **Step 1: Criar a rota**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listConteudosDoCliente } from "@/lib/roteirizacao";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { roteiroClienteId: true } });
  if (!client?.roteiroClienteId) return NextResponse.json({ conteudos: [], notLinked: true });
  try {
    return NextResponse.json({ conteudos: await listConteudosDoCliente(client.roteiroClienteId) });
  } catch {
    return NextResponse.json({ error: "Roteirização indisponível" }, { status: 502 });
  }
}
```

- [ ] **Step 2: tsc**; **Step 3: Commit**

```bash
git add "src/app/api/admin/roteirizacao/conteudos/route.ts"
git commit -m "feat(roteirizacao): rota lista conteudos do cliente vinculado"
```

### Task B3: Picker "Anexar roteiro" + puxar título/legenda

**Files:**
- Modify: `src/app/admin/(protected)/clients/[id]/page.tsx` (modal de criar/editar post)
- Modify: `src/app/api/admin/posts/[itemId]/route.ts` (PATCH aceitar `roteiroConteudoId`)

**Interfaces:**
- Consumes: `GET /api/admin/roteirizacao/conteudos` (B2); `getConteudo` opcional para prefill (ou usar o objeto já retornado pela lista).
- Produces: post gravado com `roteiroConteudoId`; `title`/`caption` preenchidos.

- [ ] **Step 1: PATCH do post aceitar `roteiroConteudoId`**

Em `src/app/api/admin/posts/[itemId]/route.ts`, adicionar ao destructuring e ao update do item:

```ts
const { /* ... */ roteiroConteudoId } = body;
...(roteiroConteudoId !== undefined && { roteiroConteudoId: roteiroConteudoId || null }),
```

- [ ] **Step 2: UI do picker no modal de post**

No modal de criar/editar post da página do cliente: botão **"Anexar roteiro"** que busca `GET /api/admin/roteirizacao/conteudos?clientId=<id>` e lista (título · tipo · status). Ao escolher um conteúdo: setar `roteiroConteudoId` no form e **preencher** `title = conteudo.titulo` e `caption = conteudo.legenda` (só se os campos estiverem vazios, ou perguntar antes de sobrescrever). Se `notLinked`, mostrar "Vincule este cliente ao Roteirização primeiro". Seguir o padrão do modal existente.

- [ ] **Step 3: Verificar (logado)**

tsc + build; no dev logado, anexar um roteiro a um post e conferir que título/legenda preencheram e `roteiroConteudoId` gravou.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(protected)/clients/[id]/page.tsx" "src/app/api/admin/posts/[itemId]/route.ts"
git commit -m "feat(roteirizacao): anexar peca ao post + puxar titulo/legenda"
```

---

## Fase C — Sincronizar status

### Task C1: Helper `syncRoteiroStatus`

**Files:**
- Create: `src/lib/syncRoteiro.ts`

**Interfaces:**
- Consumes: `prisma`, `setConteudoStatus` (A1).
- Produces: `syncRoteiroStatus(contentItemId: string): Promise<void>` (best-effort, nunca lança).

- [ ] **Step 1: Criar o helper**

```ts
import { prisma } from "@/lib/prisma";
import { setConteudoStatus } from "@/lib/roteirizacao";

/** Espelha o estado do post na peça do Roteirização. Best-effort: nunca lança. */
export async function syncRoteiroStatus(contentItemId: string): Promise<void> {
  try {
    const item = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: {
        roteiroConteudoId: true,
        approvalItem: { select: { status: true } },
        internalReviewItem: { select: { status: true } },
      },
    });
    if (!item?.roteiroConteudoId) return;
    const a = item.approvalItem?.status;
    const r = item.internalReviewItem?.status;
    const needsAdjustment = a === "ADJUSTMENT" || a === "REJECTED" || r === "ADJUSTMENT" || r === "REJECTED";
    await setConteudoStatus(item.roteiroConteudoId, needsAdjustment ? "ajuste" : "aprovado");
  } catch (e) {
    console.error("syncRoteiroStatus falhou (ignorado):", e);
  }
}
```

- [ ] **Step 2: Teste reversível de escrita (uma peça de teste)**

Rodar um script `.mjs` que: pega um `rot_conteudos` de teste, salva o status atual, chama `setConteudoStatus(id, "ajuste")`, confere que mudou, e **reverte** ao status original. Confirmar que a escrita cross-project funciona sem quebrar dados.

- [ ] **Step 3: tsc**; **Step 4: Commit**

```bash
git add src/lib/syncRoteiro.ts
git commit -m "feat(roteirizacao): helper syncRoteiroStatus (best-effort)"
```

### Task C2: Fiar o sync nos handlers de fase

**Files:**
- Modify: `src/app/api/internal/[token]/route.ts`
- Modify: `src/app/api/approval/[token]/route.ts`
- Modify: `src/app/api/admin/posts/[itemId]/route.ts`

**Interfaces:**
- Consumes: `syncRoteiroStatus` (C1).

- [ ] **Step 1: internal PATCH**

No final do `try` do PATCH (após atualizar status/approvalItem), antes do `return`:

```ts
await syncRoteiroStatus(contentItemId);
```
(import no topo: `import { syncRoteiroStatus } from "@/lib/syncRoteiro";`)

- [ ] **Step 2: approval PATCH**

Idem, após o update do post, antes do `return`: `await syncRoteiroStatus(contentItemId);`

- [ ] **Step 3: admin posts PATCH**

Após as transições de `action` (send-internal/send-client/mark-*), antes do `return`, para cada id afetado do grupo:

```ts
for (const id of ids) await syncRoteiroStatus(id);
```
(sequencial — nunca paralelo, por causa do limite de conexões.)

- [ ] **Step 4: Verificar (logado, ponta a ponta)**

tsc + build. No dev logado: anexar um roteiro a um post; pedir ajuste (cliente) → conferir que a peça virou `ajuste` no Roteirização; aprovar → conferir `aprovado`. Reverter os dados de teste.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/internal/[token]/route.ts" "src/app/api/approval/[token]/route.ts" "src/app/api/admin/posts/[itemId]/route.ts"
git commit -m "feat(roteirizacao): sincroniza status da peca nas mudancas de fase"
```

---

## Self-review (cobertura do spec)

- Cliente cross-project + funções → A1. ✓
- `Client.roteiroClienteId` + vínculo → A2/A3. ✓
- `ContentItem.roteiroConteudoId` + anexar + puxar texto → B1/B2/B3. ✓
- Sync one-way (ajuste/aprovado) fiado nos 3 handlers → C1/C2. ✓
- Best-effort / server-only / não altera Roteirização → constraints + C1. ✓
- Env de produção (Vercel) → pré-requisito. ✓

## Limpeza pós-implementação

- Remover `scripts/diag-roteirizacao.mjs` e qualquer script de teste reversível.
- Documentar as novas env vars no README/CLAUDE.md.
