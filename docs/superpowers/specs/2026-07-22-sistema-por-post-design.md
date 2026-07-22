# Sistema de aprovação por post (sem campanha)

**Data:** 2026-07-22
**Status:** Aprovado (design geral)
**Tipo:** Re-arquitetura em fases de um sistema em produção com dados reais e links vivos

## Problema

Hoje o modelo é **Cliente → Campanha → Posts**, e a `Campaign` concentra quase tudo:
token do link do cliente, token da revisão interna, fluxo de status da campanha inteira
(`DRAFT → INTERNAL_REVIEW → INTERNAL_DONE → OPEN → CLOSED → PUBLISHED`), cobrança, mês/ano,
prazo e integração de WhatsApp. Consequências relatadas pelo usuário: o sistema está
**confuso** e **com muitos bugs**. Boa parte da fragilidade vem de o sistema **deduzir o
status da campanha inteira a partir do estado dos posts** (auto-close, auto-publish,
contagens que travam), além da obrigação de **criar uma campanha** antes de inserir conteúdo.

## Objetivo

Trabalhar **por post, direto no cliente**. Sem criar campanha. Cada post anda no seu próprio
ritmo por um ciclo claro. Os links de aprovação (cliente e revisão interna) são **fixos por
cliente** e sempre reúnem os posts que estão na etapa certa naquele momento.

## Decisões de design (validadas com o usuário)

1. **Sem container.** Posts pertencem direto ao cliente. Acaba a `Campaign` como coisa criável.
2. **Duas revisões, por post:** `Rascunho → Revisão Interna → Aprovação Cliente → Aprovado → Programar → Publicado`.
3. **Links fixos por cliente** (evergreen): um link de revisão interna e um link do cliente,
   permanentes, mostrando sempre o que está pendente naquela etapa. "Enviar" = **notificar**
   (e-mail/WhatsApp) apontando para o mesmo link.
4. **Organização no admin: lista única por status** (sem mês/ano).
5. **Cobrança: removida do sistema.**
6. **Migração preservando tudo**, com **redirecionamento dos links antigos** dos clientes.

## Novo modelo de dados

### Client (ganha os dois tokens fixos)
```
Client {
  ...campos atuais...
  token          String @unique @default(uuid())              // link do cliente
  internalToken  String @unique @default(gen_random_uuid())   // link de revisão interna
  contentItems   ContentItem[]                                 // relação direta nova
}
```

### ContentItem (passa a pertencer ao cliente + status próprio)
```
ContentItem {
  ...campos atuais (fileUrl, caption, contentType, groupId, driveUrl, coverUrl,
     coverDriveUrl, scheduledDate, order, postedAt, sentToProgramacaoAt)...
  clientId  String                 // NOVO — dono direto
  client    Client @relation(...)
  status    String @default("DRAFT")  // NOVO — etapa do post (ver abaixo)
  campaignId String?               // mantido TEMPORARIAMENTE (nullable) p/ migração/rollback
}
```

**Status do post** (`ContentItem.status`):
`DRAFT` → `INTERNAL_REVIEW` → `INTERNAL_DONE` → `CLIENT_REVIEW` → `APPROVED` → `PUBLISHED`.
- Pedido de ajuste/reprovação continua em `ApprovalItem.status` / `InternalReviewItem.status`
  (`ADJUSTMENT`/`REJECTED`), que seguram o post em `CLIENT_REVIEW`/`INTERNAL_REVIEW` até resolver.
- "Programar" não é status separado: é um post `APPROVED` visível na Programação (mantém o
  `sentToProgramacaoAt` que já existe). `PUBLISHED` = `postedAt` setado.

### ApprovalItem / InternalReviewItem
Sem mudança estrutural além de tornar `campaignId` opcional/legado (a ligação real passa a ser
`contentItem → client`). Mantêm status, comentários, `reviewedAt`.

### Campaign
**Não é apagada nesta re-arquitetura.** Fica congelada (deixa de ser criada/usada pelo app),
preservada para rollback e para o redirecionamento de links legados. Remoção definitiva fica
para uma limpeza futura, fora do escopo.

## Ciclo do post e transições

- **Criar post** no cliente → `DRAFT`.
- **Enviar para revisão interna** → `INTERNAL_REVIEW`, cria `InternalReviewItem` (PENDING).
- Revisor interno aprova → `INTERNAL_DONE`; pede ajuste → segura em `INTERNAL_REVIEW` com
  `InternalReviewItem.status = ADJUSTMENT` até "ajuste feito".
- **Enviar para o cliente** (a partir de `INTERNAL_DONE`) → `CLIENT_REVIEW`, cria `ApprovalItem` (PENDING).
- Cliente aprova → `APPROVED`; pede ajuste/reprova → segura em `CLIENT_REVIEW`.
- Post `APPROVED` pode ser **enviado à Programação** (`sentToProgramacaoAt`), agendado (data) e
  marcado **Publicado** → `PUBLISHED`.
- "Ajuste feito" reseta a etapa correspondente (igual à lógica atual por item), limpando o
  `sentToProgramacaoAt` quando cabível.

## Links públicos (fixos por cliente)

- **`/aprovar/[clientToken]`** — mostra os posts do cliente em `CLIENT_REVIEW`
  (`ApprovalItem` pendente/ajuste). Cliente aprova/pede ajuste por post. Evergreen.
- **`/revisar/[clientInternalToken]`** — mostra os posts em `INTERNAL_REVIEW`. Time interno
  aprova/pede ajuste por post. Evergreen.
- **Redirecionamento de links legados:** `/aprovar/[token]` e `/revisar/[token]` onde o token
  é de uma **campanha** (não bate com nenhum cliente) → redireciona para o link novo do
  **cliente daquela campanha**. Quem tiver o link antigo continua funcionando.
- As páginas públicas reaproveitam o visual atual das telas de aprovação/revisão, agora
  listando posts do cliente (agrupados por status/etapa) em vez de posts de uma campanha.

## Admin (nova experiência)

- **Página do cliente** (`/admin/clients/[id]`) vira o workspace principal: posts do cliente
  **agrupados por status** (Rascunho / Revisão interna / Aprovação cliente / Aprovado /
  Publicado), com ações por post (enviar p/ revisão, enviar p/ cliente, ajuste feito, enviar p/
  programação, marcar publicado) e os **links fixos** (cliente, revisão interna, social media)
  para copiar. Adicionar post = upload por Drive direto no cliente (adapta o `FolderUploadModal`).
- **Dashboard** (`/admin`) deixa de ser o kanban de campanhas e passa a ser uma visão de
  **o que precisa de atenção por etapa, entre todos os clientes** (ex.: contadores e listas:
  "aguardando revisão interna", "aguardando cliente há X dias", "prontos para programar").
- **Programação e Planner** continuam, adaptados para puxar posts **por cliente** (já são
  orientados a post; hoje dependem de `campaign.status CLOSED/PUBLISHED` — passam a depender do
  `status`/`sentToProgramacaoAt` do post).
- **Notificações** (e-mail em `mail.ts`, WhatsApp em `whatsapp.ts`, cron de lembrete) passam a
  apontar para os **links fixos do cliente** em vez do link da campanha.

## Migração (preservar tudo)

Script único, idempotente, rodado uma vez contra o Supabase (o projeto usa `db push`/SQL
direto — o histórico de migração não é confiável; ver `local-dev-gotchas`). Passos:

1. Aplicar as mudanças de schema (colunas novas: `Client.token`, `Client.internalToken`,
   `ContentItem.clientId`, `ContentItem.status`) via `db push`/`ALTER TABLE` — todas aditivas.
2. Para cada `ContentItem`: preencher `clientId = campaign.clientId` e **deduzir `status`** do
   estado atual do próprio item:
   - `postedAt` setado → `PUBLISHED`
   - senão `ApprovalItem.status = APPROVED` → `APPROVED`
   - senão tem `ApprovalItem` (pendente/ajuste/reprovado) → `CLIENT_REVIEW`
   - senão `InternalReviewItem.status = APPROVED` → `INTERNAL_DONE`
   - senão tem `InternalReviewItem` → `INTERNAL_REVIEW`
   - senão → `DRAFT`
3. Gerar `token`/`internalToken` para cada `Client` que não tiver.
4. Não apagar `Campaign`. Manter `campaignId` nos itens para redirecionar links legados.

**Rollback:** como nada é destruído (colunas aditivas, `Campaign` intacta), reverter é possível
desfazendo o uso das colunas novas.

## Execução em fases (cada fase testada e no ar antes da próxima)

- **Fase 1 — Fundação + migração.** Colunas novas + script de migração preservando tudo.
  Nenhuma mudança visível ainda. Critério: todo post tem `clientId` e `status` corretos; todo
  cliente tem os dois tokens; nada quebrou.
- **Fase 2 — Links públicos por cliente.** Novos `/aprovar` e `/revisar` evergreen + submits por
  post + redirecionamento dos links legados. Critério: cliente/time aprovam por post; links
  antigos redirecionam.
- **Fase 3 — Admin.** Workspace do cliente por status + dashboard novo + adicionar post no
  cliente + notificações repontando para os links do cliente.
- **Fase 4 — Programação/Planner + limpeza.** Adaptar Programação/Planner ao novo modelo;
  remover restos de campanha e a cobrança da interface.

Cada fase terá seu próprio plano detalhado (writing-plans) e ciclo de implementação/review/deploy.

## Fora de escopo (por ora)

- Apagar a tabela `Campaign` e colunas `campaignId` (limpeza futura, depois de estabilizar).
- Redesenho de cobrança (removida, não reprojetada).
- Reprocessar/reorganizar histórico antigo além do necessário para a lista por status.

## Bugs a mirar

O usuário relatou "muitos bugs" sem enumerar. O novo modelo **remove por construção** a classe
de bug mais provável: a dedução de status **da campanha inteira** a partir dos posts (auto-close/
auto-publish/contadores). Se houver bugs específicos conhecidos, incorporar como critérios de
aceite ao detalhar cada fase.

## Critérios de sucesso (macro)

1. Dá para adicionar posts a um cliente **sem criar campanha**.
2. Cada post tem status próprio e anda independente dos demais.
3. O link do cliente mostra sempre os posts aguardando aprovação; o link interno, os em revisão
   interna. Aprovar/avançar remove o post do link.
4. Links antigos dos clientes continuam funcionando (redirecionam).
5. Nenhum dado é perdido na migração; aprovações/comentários/datas preservados.
6. Cobrança e mês/ano não aparecem mais.
