# Link da Programação por cliente (para o social media)

**Data:** 2026-07-10
**Status:** Aprovado

## Problema

A tela de **Programação** (`/admin/programacao`) é protegida por login. O social media que
vai efetivamente agendar/publicar os posts do cliente não tem acesso — hoje seria preciso
mandar prints, links do Drive e legendas separadamente. Falta um link público, escopado a um
cliente, com todos os detalhes necessários para agendar.

## Objetivo

Um link público **por cliente** que abre uma página com todos os posts prontos para agendar
daquele cliente (assets no Drive, legenda copiável, data agendada), onde o social media pode
marcar cada post como **"Agendado ✓"**. Enviado a partir do painel da Programação.

## Identidade / rota

Página pública **`/programar/[clientId]`** (`clientId` é um cuid não-adivinhável — mesmo modelo
de segurança de `/post/[id]` e `/aprovar/[token]`: público, protegido só pela URL secreta).
**Sem migração de banco.** Middleware não muda (só protege `/admin/*` e `/api/admin/*`, então
`/programar/*` e `/api/programar/*` já são públicos).

## Quais posts aparecem

Os posts **prontos para agendar** do cliente, agrupados por campanha. Critério (idêntico ao
da Programação atual, reaproveitado):

- não é `TEXTO`;
- aprovado internamente (ou sem revisão interna): `internalReviewItem` ausente ou `status === "APPROVED"`;
- aprovado pelo cliente: `approvalItem.status === "APPROVED"`;
- na programação: campanha `CLOSED`/`PUBLISHED` **ou** `sentToProgramacaoAt != null`;
- **ainda não postado**: `postedAt == null`.

Carrossel conta como 1 post (agrupado por `groupId`, representado pelo primeiro slide).

## Comportamento da página

- Read-only, tema escuro (`#0f0f0f`, `white/10`), pt-BR. Cabeçalho com o nome do cliente.
- Posts agrupados por campanha. Cada post mostra: thumbnail, tipo, **data agendada** (quando
  houver), botão **"🔗 Arquivo no Drive"**, **"🖼️ Capa no Drive"** (quando REELS + `coverDriveUrl`),
  a **legenda** com botão **Copiar** (reusa `CopyButton`), e o botão **"Agendado ✓"**.
- Clicar **"Agendado ✓"** → marca `postedAt = agora` via a API pública; o post sai da lista.
- Se, após marcar, todos os posts aprovados da campanha estiverem postados, a campanha vira
  `PUBLISHED` (mesma regra do admin hoje).
- Estados: "Carregando...", "Cliente não encontrado" (404), e um estado vazio ("Nenhum post
  para agendar no momento").

## Componentes

### 1. Refactor (DRY) — `src/lib/programacao.ts` (criar)
Extrair da `programacao/page.tsx` para um módulo compartilhado, sem mudar comportamento:
- o objeto `select` de `contentItems` usado na query (incluindo `sentToProgramacaoAt`);
- o tipo do post (`SchedulablePost`) e da campanha de entrada;
- a função `getSchedulablePosts(campaign): SchedulablePost[]` (a atual `getApprovedPosts`,
  com o gate `campaignReleased || sentToProgramacaoAt`).

`programacao/page.tsx` passa a importar esses itens em vez de defini-los localmente. O tipo
canônico do post passa a viver na lib como `SchedulablePost` com **exatamente os mesmos
campos** do `Post` atual de `ProgramacaoKanban` (`id, campaignId, campaignName, title,
contentType, fileType, fileUrl, coverUrl, coverDriveUrl, caption, driveUrl, groupId,
scheduledDate, postedAt, approvedAt`). `ProgramacaoKanban` importa `SchedulablePost` da lib
(pode reexportá-lo como `Post` para não mexer nos consumidores). Assim admin e API pública
usam o mesmo tipo, sem divergência.

### 2. API pública — `src/app/api/programar/[clientId]/route.ts` (criar)
- `GET`: busca o cliente por `id`; 404 se não existir. Busca as campanhas do cliente
  (mesma `where` da Programação: `OR [status in CLOSED/PUBLISHED, contentItems some sentToProgramacaoAt != null]`)
  com o `select` compartilhado, roda `getSchedulablePosts` em cada uma, filtra `postedAt == null`,
  e retorna `{ clientName, campaigns: [{ campaignId, campaignName, posts: SchedulablePost[] }] }`
  (só campanhas com ≥1 post).
- `PATCH`: body `{ contentItemId }`. **Guarda IDOR**: confirma que o `ContentItem` existe e que
  `contentItem.campaign.clientId === params.clientId`; senão 404. Seta `postedAt = new Date()`.
  Depois, roda a mesma checagem de auto-publish do admin: se todos os itens `APPROVED` da
  campanha têm `postedAt`, seta a campanha para `PUBLISHED`. Espelha
  `src/app/api/admin/campaigns/[id]/items/[itemId]/route.ts`.
- `try/catch` com 500 genérico; mensagens de erro em pt-BR.

### 3. Página pública — `src/app/programar/[clientId]/page.tsx` (criar)
`"use client"`. Faz `fetch` de `/api/programar/[clientId]`, renderiza a lista agrupada por
campanha reusando o visual das linhas de post da Programação (thumb, tipo, data, links do
Drive, legenda + `CopyButton`, botão "Agendado ✓"). O "Agendado ✓" faz `PATCH` e remove o
post do estado local. Sem qualquer ação de edição.

### 4. Botão no admin — `src/components/admin/ProgramacaoKanban.tsx` (modificar)
No cabeçalho do card de cada cliente (junto do botão "📅 Planner", via o slot já existente ou
um novo), um botão **"🔗 Link social media"** que copia `${window.location.origin}/programar/${clientId}`
com feedback "Copiado!" (~2s). Como o link é por cliente, todos os cards da mesma marca copiam
o mesmo link (esperado).

## Fora de escopo (YAGNI)

- Sem definição de datas na página pública (continua no Planner do admin).
- Sem token dedicado/rotação (usa o `clientId`).
- Sem e-mail/notificação automática.
- Sem edição de legenda/assets pela página pública.

## Critérios de sucesso

1. `/programar/<clientId>` (sem login) mostra os posts a agendar daquele cliente, agrupados por
   campanha, com data, links do Drive e legenda copiável.
2. Clicar "Agendado ✓" marca o post como postado e o remove da lista; recarregar a página não o
   traz de volta.
3. Marcar o último post aprovado de uma campanha publica a campanha (status `PUBLISHED`).
4. Um `clientId` inexistente mostra "Cliente não encontrado".
5. O PATCH recusa marcar um `contentItemId` que não pertence ao `clientId` da URL (404).
6. Posts `TEXTO`, não aprovados, não liberados à programação, ou já postados não aparecem.
7. A tela admin da Programação continua funcionando igual após o refactor (sem regressão).
8. Na Programação admin, o botão "🔗 Link social media" copia a URL correta do cliente.
