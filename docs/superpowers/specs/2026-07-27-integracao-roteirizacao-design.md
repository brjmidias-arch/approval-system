# Integração Aprovação ↔ Roteirização — Design

**Data:** 2026-07-27
**Objetivo:** ao inserir um post no approval-system, anexar a peça correspondente do sistema de Roteirização, puxar o texto do roteiro para o post e sincronizar o status da peça no Roteirização conforme as fases da aprovação.

## Contexto dos dois sistemas

- **Aprovação** (este repo): Next.js + Prisma + Supabase project `wlactdxqoaabkocthyle`. Post = `ContentItem` (fases: DRAFT, INTERNAL_REVIEW, CLIENT_REVIEW, APPROVED, SCHEDULED, PUBLISHED; ajuste via approvalItem/internalReviewItem).
- **Roteirização**: app estático (`output/index.html`) + Supabase project `kyxwmvgxufjwkiyodsgd` + edge functions. Tabelas:
  - `rot_clientes` (cliente).
  - `rot_roteiros` (mês do cliente, `status`).
  - `rot_conteudos` (peça individual: `tipo` reel/carrossel/estatico, `titulo`, `gancho`, `desenvolvimento`, `cta`, `legenda`, `hashtags`, `status` ∈ pendente|aprovado|ajuste|regenerando, `data_sugerida`).
- **Bancos Supabase SEPARADOS** → integração cross-project: o aprovação lê/escreve no banco do roteirização via **service role key** (server-only).

## Decisões (confirmadas)

1. **Vínculo por peça individual** — post do aprovação ↔ `rot_conteudos` (1-para-1).
2. **Reaproveitar os 4 status atuais** do roteirização (NÃO alterar o app do roteirização).
3. **Puxar o texto** do roteiro ao anexar (preenche título/legenda do post; editável).
4. **One-way**: aprovação → roteirização (sem sincronização reversa).

## Arquitetura

### Cliente de acesso ao Roteirização
Novo `src/lib/roteirizacao.ts` — cria um Supabase client apontando para o projeto do roteirização (service role, **só servidor**). Funções:
- `listConteudosDoCliente(rotClienteId)` → peças do cliente (para o picker).
- `getConteudo(id)` → uma peça (para puxar título/legenda).
- `setConteudoStatus(id, status)` → atualiza `rot_conteudos.status`.

### Env (Vercel, aprovação)
- `ROTEIRIZACAO_SUPABASE_URL` = `https://kyxwmvgxufjwkiyodsgd.supabase.co`
- `ROTEIRIZACAO_SUPABASE_SERVICE_ROLE_KEY` = (service role do projeto do roteirização)

### Dados novos no aprovação (Prisma)
- `Client.roteiroClienteId` (String?, uuid do `rot_clientes`) — liga cada cliente do aprovação ao do roteirização, **uma vez** (sugerir por nome, confirmar).
- `ContentItem.roteiroConteudoId` (String?, uuid do `rot_conteudos`) — a peça anexada ao post.

### Fluxo
1. **Ligar cliente↔cliente** (setup, 1x por cliente): tela nas configs do cliente sugere match por nome e grava `roteiroClienteId`.
2. **Anexar** (criar/editar post): controle "Anexar roteiro" no workspace lista `rot_conteudos` do cliente (título·tipo·status); ao escolher, grava `roteiroConteudoId` e **puxa** `titulo`→título e `legenda`→caption (editável).
3. **Sincronizar status**: helper único `syncRoteiroStatus(contentItemId)`:
   - carrega o post + `roteiroConteudoId` + status de approvalItem/internalReviewItem;
   - se sem vínculo, retorna;
   - alvo = `ajuste` se needsAdjustment (cliente OU interno pediu ajuste/reprovou), senão `aprovado`;
   - chama `setConteudoStatus`.
   Chamado no fim de cada PATCH que muda revisão/aprovação (`api/internal/[token]`, `api/approval/[token]`, `api/admin/posts/[itemId]`).

### Segurança e robustez
- Service role key só no env server do aprovação; todas as chamadas ao roteirização são server-side.
- Sync é **best-effort**: falha do roteirização é logada mas **não quebra** a ação da aprovação. Picker mostra erro amigável se o roteirização estiver indisponível.

## Mapeamento de status (aprovação → roteirização)

| Situação no aprovação | rot_conteudos.status |
|---|---|
| Cliente ou interno pediu ajuste/reprova (needsAdjustment) | `ajuste` |
| Em produção / aprovado / programado / publicado | `aprovado` |

(`pendente`/`regenerando` permanecem geridos pelo próprio roteirização.)

## Fases de execução

- **Fase A — Fundação:** env + `roteirizacao.ts` + `Client.roteiroClienteId` (migration) + tela de ligar cliente↔cliente + `listConteudosDoCliente`.
- **Fase B — Anexar + preencher:** `ContentItem.roteiroConteudoId` (migration) + picker no workspace + puxar título/legenda.
- **Fase C — Sincronizar status:** helper `syncRoteiroStatus` fiado nos handlers de fase.

## Fora de escopo

- Sincronização reversa (roteirização → aprovação).
- Alterar o app/estrutura de status do roteirização.
- Anexar em lote (pode virar melhoria depois).
