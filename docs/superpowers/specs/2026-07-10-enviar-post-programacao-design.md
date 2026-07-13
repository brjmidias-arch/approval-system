# Botão "Enviar para Programação" por post

**Data:** 2026-07-10
**Status:** Aprovado

## Problema

Hoje um post só chega na tela de **Programação** quando a campanha inteira vira `CLOSED`
ou `PUBLISHED` (a query em `programacao/page.tsx` filtra `status in ["CLOSED","PUBLISHED"]`).
Consequência: numa campanha com posts em estados mistos — alguns "Aprovado" pelo cliente,
outro "Reprovado" aguardando ajuste — os posts prontos ficam presos, porque a campanha não
fecha enquanto houver pendências. O usuário quer destravar os posts prontos e mandá-los para
a Programação sem esperar a campanha inteira.

## Objetivo

Um botão **por post** na página da campanha que envia aquele post (já aprovado pelo cliente)
para a Programação imediatamente, mesmo com a campanha ainda aberta. Reversível.

## Modelo de dados

Adicionar um marcador por post no `ContentItem`:

```prisma
model ContentItem {
  ...
  sentToProgramacaoAt  DateTime?
}
```

Campo nullable → migração aditiva e segura, não afeta dados/queries existentes.
(Alternativa descartada: tabela separada de "etapa" — over-engineering para um marcador
simples, YAGNI.)

## Comportamento

- O botão **"→ Programação"** aparece **apenas em posts com status Aprovado pelo cliente**
  (`approvalItem.status === "APPROVED"`), em posts únicos e carrosséis. Não aparece em
  posts do tipo `TEXTO` (a Programação já ignora texto).
- Clicar → seta `sentToProgramacaoAt = new Date()`. O post passa a aparecer na Programação
  mesmo com a campanha ainda `OPEN`.
- Depois de enviado, o post continua na campanha com um **selo "✓ Na Programação"** e o
  botão vira **"Remover da Programação"**, que seta `sentToProgramacaoAt = null`.
- **Carrossel**: o marcador é aplicado a **todos os slides do grupo** (`groupId`), seguindo
  o mesmo padrão que o PATCH já usa para `scheduledDate`. O selo/botão do carrossel usa o
  slide representante (`slides[0]`).
- **Limpeza automática no "Ajuste feito"**: o handler `resetApproval` existente (que volta a
  aprovação do post para `PENDING`) passa a **também limpar `sentToProgramacaoAt`** — um post
  que voltou para ajuste sai da Programação automaticamente. Vale para post único e para todos
  os slides do carrossel.

## Componentes

### 1. Migração Prisma
- Adicionar `sentToProgramacaoAt DateTime?` ao model `ContentItem` em `prisma/schema.prisma`.
- Gerar a migração com `npx prisma migrate dev --name add_sent_to_programacao` (aplica no
  banco Supabase e cria o arquivo de migração).

### 2. PATCH `/api/admin/campaigns/[id]/items/[itemId]/route.ts`
- Aceitar `sentToProgramacao: boolean` no body.
- `true` → `sentToProgramacaoAt = new Date()`; `false` → `sentToProgramacaoAt = null`.
- Propagar para o grupo do carrossel: se o item tem `groupId` e `contentType === "CARROSSEL"`,
  aplicar o mesmo valor a todos os itens do grupo (`updateMany`), igual ao que já é feito
  para `scheduledDate`.
- No bloco `resetApproval` existente, adicionar `sentToProgramacaoAt: null` ao update do item
  (e, para carrossel, ao grupo).

### 3. Página da campanha — `src/app/admin/(protected)/campaigns/[id]/page.tsx`
- A interface `ContentItem` local ganha `sentToProgramacaoAt: string | null`.
- O GET `/api/admin/campaigns/[id]` já retorna todos os campos do item (usa `include`), então
  o campo vem sem mudança no backend do GET.
- **Post único**: na linha de ações do card, quando `statusKey === "APPROVED"`:
  - Se `sentToProgramacaoAt == null` → botão "→ Programação" que faz `PATCH { sentToProgramacao: true }`.
  - Se `sentToProgramacaoAt != null` → selo "✓ Na Programação" + botão "Remover da Programação"
    que faz `PATCH { sentToProgramacao: false }`.
  - Ambos chamam `fetchCampaign()` ao concluir.
- Handler novo `handleToggleProgramacao(itemId, next: boolean)` seguindo o padrão dos handlers
  existentes (`handleMarkItemDone` etc.), com estado de "salvando" por item.

### 4. CarouselCard — `src/components/admin/CarouselCard.tsx`
- A interface `SlideItem` ganha `sentToProgramacaoAt: string | null`.
- Condição de aprovação do carrossel: representante `slides[0].approvalItem?.status === "APPROVED"`.
- Mesma UI que o post único (botão "→ Programação" / selo + "Remover"), na linha de botões
  existente (junto de "Editar / Adicionar slides" e "🔗 Link p/ designer"). Aplica no id do
  representante (`slides[0].id`); a propagação ao grupo é feita no backend.

### 5. Página da Programação — `src/app/admin/(protected)/programacao/page.tsx`
- Ampliar a query `prisma.campaign.findMany`:
  ```
  where: {
    OR: [
      { status: { in: ["CLOSED", "PUBLISHED"] } },
      { contentItems: { some: { sentToProgramacaoAt: { not: null } } } },
    ],
  }
  ```
- Incluir `sentToProgramacaoAt` no `select` de `contentItems`.
- Em `getApprovedPosts`, um post entra se: não é TEXTO, é aprovado internamente (ou sem revisão
  interna), tem aprovação do cliente `APPROVED`, **E** (`campaign.status` é `CLOSED`/`PUBLISHED`
  **OU** `item.sentToProgramacaoAt != null`).
- Comportamento atual preservado: campanhas fechadas continuam mandando todos os aprovados
  automaticamente (a condição do OR cobre isso).

## Nota operacional (deploy)

O deploy (push → Vercel) **não roda migração** (`npm run build` só faz `prisma generate`).
A coluna `sentToProgramacaoAt` precisa existir no banco Supabase **antes** de o código novo
subir, senão as queries que a selecionam quebram. Ordem correta:

1. Rodar `npx prisma migrate dev --name add_sent_to_programacao` (aplica no Supabase).
2. Só então commitar/pushar o código.

Como o projeto usa um único banco Supabase (dev = prod), aplicar a migração uma vez basta.

## Fora de escopo (YAGNI)

- Sem botão "enviar todos de uma vez" — apenas por post.
- Sem notificação/e-mail ao enviar.
- Sem mudança no fluxo de status da campanha (ela continua `OPEN` até fechar normalmente).

## Critérios de sucesso

1. Numa campanha `OPEN`, um post com status "Aprovado" mostra o botão "→ Programação".
2. Clicar no botão faz o post aparecer na aba Programação, mesmo a campanha seguindo aberta.
3. O post enviado mostra o selo "✓ Na Programação" e um botão para remover; remover tira o
   post da Programação.
4. Carrossel envia/remove o grupo inteiro de uma vez.
5. Clicar em "Ajuste feito" num post que estava na Programação o remove de lá automaticamente.
6. Campanhas fechadas continuam listando todos os posts aprovados na Programação (sem regressão).
7. Posts `TEXTO` e posts não aprovados pelo cliente não mostram o botão.
