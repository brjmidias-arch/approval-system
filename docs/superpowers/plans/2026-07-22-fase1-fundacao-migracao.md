# Fase 1 — Fundação + migração (sistema por post) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar o banco para o modelo por post — adicionar `Client.token`/`Client.internalToken`, `ContentItem.clientId` e `ContentItem.status` — e migrar os dados existentes preservando tudo, **sem nenhuma mudança visível** no app.

**Architecture:** Colunas novas são **aditivas** e aplicadas por **SQL direto** (o projeto usa `db push`/SQL — histórico de migração não é confiável, ver `local-dev-gotchas`). Um script idempotente preenche `clientId` (do `campaign.clientId`) e deduz `status` por post, tratando carrossel por grupo. A `Campaign` e `campaignId` ficam intactos (rollback/redirect nas fases seguintes).

**Tech Stack:** Prisma, PostgreSQL (Supabase), Node (script de migração), TypeScript.

## Global Constraints

- **Somente aditivo.** Nenhuma coluna/linha existente é removida ou sobrescrita (exceto os campos novos). `Campaign`, `campaignId` e todos os dados atuais permanecem.
- **Schema aplicado por SQL direto** (idempotente, `IF NOT EXISTS`), depois `schema.prisma` é editado para refletir, depois `npx prisma generate`. **NÃO** rodar `prisma migrate dev` (resetaria o banco — histórico dessincronizado).
- **Banco único Supabase (dev=prod).** A migração roda uma vez contra o banco real. Garantir que existe backup/PITR no Supabase antes (o usuário confirma).
- **Status derivado por post; carrossel por grupo** (representante = menor `order` do `groupId`), aplicado igual a todos os slides.
- **Sem framework de testes** — verificação por queries SQL/Prisma + `npx tsc --noEmit`. **NÃO** rodar `npm run lint`.
- **Nenhuma mudança de UI/rotas nesta fase.**

---

## File Structure

- `prisma/schema.prisma` — **modificar**. Novos campos em `Client` e `ContentItem`.
- `scripts/migrate-per-post-fase1.mjs` — **criar**. Script de backfill idempotente (fica versionado para auditoria/rerun).

---

## Task 1: Colunas novas (SQL direto) + schema.prisma + generate

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: colunas `Client.token`, `Client.internalToken` (TEXT, unique, nullable por ora), `ContentItem.clientId` (TEXT nullable, FK→Client), `ContentItem.status` (TEXT NOT NULL default 'DRAFT'); e os campos correspondentes no Prisma Client.

- [ ] **Step 1: Aplicar as colunas no banco via SQL direto**

Rodar (idempotente, `IF NOT EXISTS`) um script `.mjs` temporário OU inline. Conteúdo do DDL a aplicar, um `$executeRawUnsafe` por statement:

```
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "token" TEXT
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "internalToken" TEXT
CREATE UNIQUE INDEX IF NOT EXISTS "Client_token_key" ON "Client"("token")
CREATE UNIQUE INDEX IF NOT EXISTS "Client_internalToken_key" ON "Client"("internalToken")
ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "clientId" TEXT
ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT'
```

E o FK (Postgres não tem `IF NOT EXISTS` para constraint — usar bloco `DO`):
```
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContentItem_clientId_fkey') THEN
    ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
```

Criar `scripts/ddl-fase1.mjs` com esse conteúdo e rodar `node scripts/ddl-fase1.mjs`:

```js
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const stmts = [
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "token" TEXT`,
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "internalToken" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Client_token_key" ON "Client"("token")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Client_internalToken_key" ON "Client"("internalToken")`,
  `ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "clientId" TEXT`,
  `ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT'`,
];
for (const s of stmts) { await p.$executeRawUnsafe(s); console.log("ok:", s.slice(0, 60)); }
await p.$executeRawUnsafe(
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContentItem_clientId_fkey') THEN ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
);
console.log("FK ok");
await p.$disconnect();
```
Run: `node scripts/ddl-fase1.mjs`
Expected: imprime `ok:` para cada statement e `FK ok`, sem erro. (Rerun não quebra.)

- [ ] **Step 2: Confirmar as colunas no banco**

Run:
```bash
node --input-type=module -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); const c=await p.\$queryRawUnsafe(\`SELECT table_name, column_name FROM information_schema.columns WHERE (table_name='Client' AND column_name IN ('token','internalToken')) OR (table_name='ContentItem' AND column_name IN ('clientId','status')) ORDER BY 1,2\`); console.log(JSON.stringify(c)); await p.\$disconnect();"
```
Expected: 4 linhas — `Client.internalToken`, `Client.token`, `ContentItem.clientId`, `ContentItem.status`.

- [ ] **Step 3: Editar `prisma/schema.prisma` para refletir as colunas**

No model `Client`, adicionar (após o campo `whatsapp`):
```prisma
  token         String?       @unique @default(uuid())
  internalToken String?       @unique @default(dbgenerated("gen_random_uuid()"))
  contentItems  ContentItem[]
```

No model `ContentItem`, adicionar (após `sentToProgramacaoAt`):
```prisma
  clientId           String?
  client             Client?             @relation(fields: [clientId], references: [id], onDelete: Cascade)
  status             String              @default("DRAFT")
```

(Ficam **nullable** por ora para casar com o banco; um cleanup futuro pode apertar para NOT NULL após o backfill.)

- [ ] **Step 4: Regenerar o Prisma Client e checar tipos**

Run: `npx prisma generate`
Then: `npx tsc --noEmit`
Expected: generate sem erro; tsc zero erros. (O app atual não usa os campos novos, então nada quebra.)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(fase1): add clientId/status to ContentItem and tokens to Client"
```

---

## Task 2: Script de backfill (clientId + status + tokens) + verificação

**Files:**
- Create: `scripts/migrate-per-post-fase1.mjs`

**Interfaces:**
- Consumes: colunas da Task 1; Prisma Client.
- Produces: todo `Client` com `token`/`internalToken`; todo `ContentItem` com `clientId` (= `campaign.clientId`) e `status` derivado (carrossel uniforme por grupo).

- [ ] **Step 1: Criar o script**

Create `scripts/migrate-per-post-fase1.mjs`:

```js
// Fase 1 — backfill idempotente para o modelo por post.
// Preenche Client.token/internalToken, ContentItem.clientId e ContentItem.status.
// Status por post; carrossel deduzido pelo primeiro slide (menor order) e aplicado a todos.
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// IMPORTANTE: todo item ganha um ApprovalItem na criação, então a mera existência dele NÃO
// significa "enviado ao cliente". O sinal real da etapa é o status da CAMPANHA.
function deriveStatus(item, campaignStatus) {
  if (item.postedAt) return "PUBLISHED";
  if (item.approvalItem?.status === "APPROVED") return "APPROVED";
  switch (campaignStatus) {
    case "DRAFT": return "DRAFT";
    case "INTERNAL_REVIEW": return "INTERNAL_REVIEW";
    case "INTERNAL_DONE":
      return item.internalReviewItem?.status === "APPROVED" ? "INTERNAL_DONE" : "INTERNAL_REVIEW";
    case "OPEN":
    case "CLOSED":
    case "PUBLISHED":
      if (item.internalReviewItem && item.internalReviewItem.status !== "APPROVED") return "INTERNAL_REVIEW";
      return "CLIENT_REVIEW";
    default: return "DRAFT";
  }
}

async function main() {
  // 1) Tokens por cliente (só onde faltar)
  const clients = await prisma.client.findMany({ select: { id: true, token: true, internalToken: true } });
  let tokensSet = 0;
  for (const c of clients) {
    const data = {};
    if (!c.token) data.token = randomUUID();
    if (!c.internalToken) data.internalToken = randomUUID();
    if (Object.keys(data).length) { await prisma.client.update({ where: { id: c.id }, data }); tokensSet++; }
  }
  console.log(`clientes com token preenchido: ${tokensSet}/${clients.length}`);

  // 2) clientId + status por post (carrossel uniforme por grupo)
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true, clientId: true, status: true,
      contentItems: {
        select: {
          id: true, groupId: true, contentType: true, order: true, postedAt: true,
          approvalItem: { select: { status: true } },
          internalReviewItem: { select: { status: true } },
        },
      },
    },
  });

  let itemsUpdated = 0;
  for (const camp of campaigns) {
    const sorted = [...camp.contentItems].sort((a, b) => a.order - b.order);
    // representante por chave (carrossel: groupId; single: id)
    const statusByKey = new Map();
    for (const it of sorted) {
      const key = it.contentType === "CARROSSEL" && it.groupId ? `g:${it.groupId}` : `i:${it.id}`;
      if (!statusByKey.has(key)) statusByKey.set(key, deriveStatus(it, camp.status)); // primeiro (menor order) = representante
    }
    for (const it of camp.contentItems) {
      const key = it.contentType === "CARROSSEL" && it.groupId ? `g:${it.groupId}` : `i:${it.id}`;
      const status = statusByKey.get(key);
      await prisma.contentItem.update({ where: { id: it.id }, data: { clientId: camp.clientId, status } });
      itemsUpdated++;
    }
  }
  console.log(`posts atualizados (clientId+status): ${itemsUpdated}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 2: Rodar o script**

Run: `node scripts/migrate-per-post-fase1.mjs`
Expected: imprime "clientes com token preenchido: N/N" e "posts atualizados: M" sem erro.

- [ ] **Step 3: Verificar integridade (tudo preenchido, contagens batendo)**

Run:
```bash
node --input-type=module -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); const nc=await p.contentItem.count({where:{clientId:null}}); const nt=await p.client.count({where:{OR:[{token:null},{internalToken:null}]}}); const total=await p.contentItem.count(); const bs=await p.contentItem.groupBy({by:['status'],_count:true}); const rows=await p.\$queryRawUnsafe(\`SELECT \\\"groupId\\\", COUNT(DISTINCT status) d FROM \\\"ContentItem\\\" WHERE \\\"groupId\\\" IS NOT NULL GROUP BY \\\"groupId\\\" HAVING COUNT(DISTINCT status) > 1\`); console.log('sem clientId (0):',nc); console.log('sem token (0):',nt); console.log('total:',total); console.log('status:',JSON.stringify(bs.map(b=>({s:b.status,n:b._count})))); console.log('carrossel divergente (0):',rows.length); await p.\$disconnect();"
```
Expected: `sem clientId = 0`, `sem token = 0`, `carrossel divergente = 0`; distribuição por status coerente; `total` igual ao número de itens antes da migração (nenhuma linha criada/apagada).

- [ ] **Step 4: Spot-check (status derivado vs estado real de alguns posts)**

Run:
```bash
node --input-type=module -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); const s=await p.contentItem.findMany({take:8,select:{status:true,postedAt:true,approvalItem:{select:{status:true}},internalReviewItem:{select:{status:true}}}}); for(const x of s) console.log(x.status,'| posted:',!!x.postedAt,'| aprov:',x.approvalItem?.status,'| interna:',x.internalReviewItem?.status); await p.\$disconnect();"
```
Expected: cada linha bate com a regra: postado→PUBLISHED; aprov=APPROVED→APPROVED; tem aprov→CLIENT_REVIEW; interna=APPROVED→INTERNAL_DONE; tem interna→INTERNAL_REVIEW; senão DRAFT.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-per-post-fase1.mjs
git commit -m "feat(fase1): idempotent backfill script for clientId/status/tokens"
```

---

## Self-Review (feito na escrita)

- **Cobertura da spec (Fase 1):** colunas novas (Task 1); backfill preservando tudo, status derivado por post com carrossel uniforme, tokens por cliente (Task 2). Critério da Fase 1 (todo post com clientId+status; todo cliente com tokens; nada quebrou) coberto. ✅
- **Somente aditivo:** apenas `ADD COLUMN`/índices/FK e `UPDATE` de campos novos; `Campaign`/`campaignId`/dados atuais intactos. Rollback = parar de usar as colunas. ✅
- **Idempotência:** DDL com `IF NOT EXISTS`; tokens só onde nulo; status recalculado deterministicamente (rerun seguro). ✅
- **Carrossel:** status por grupo via representante (menor order), verificado por query de divergência. ✅
- **Consistência de tipos:** `deriveStatus` retorna exatamente os 6 valores do enum de status da spec; os campos lidos (`postedAt`, `approvalItem.status`, `internalReviewItem.status`) existem no schema atual. ✅
- **Sem placeholders / código completo.** ✅
- **Sem regressão de app:** os campos novos não são lidos por nenhuma tela nesta fase; `tsc` confirma. ✅

## Próximas fases (não implementar aqui)

- Fase 2: links públicos por cliente + redirecionamento legado.
- Fase 3: admin (workspace por status, dashboard, notificações).
- Fase 4: Programação/Planner + limpeza (remover restos de campanha/cobrança).
