# Programação dissolvida no Dashboard — Design

**Data:** 2026-07-24
**Objetivo:** acabar com a aba "Programação" e trazer todas as suas funcionalidades para o dashboard (visão única).

## Fluxo do post (novo)

1. **Prontos p/ programar** (status `APPROVED`) — no card:
   - **seletor de data** (grava `scheduledDate`; o post continua nesta etapa, só passa a mostrar o dia);
   - **🔗 Copiar link da programação** (copia `/programar/{clientId}`);
   - selo de **dias esperando** (a partir de `approvalItem.reviewedAt`).
2. O admin envia o link `/programar/{clientId}` ao social media. Ele abre, vê os posts (dia, legenda, Drive) e clica **"Agendado"**.
3. **Posts programados** (status novo `SCHEDULED`) — o post chega aqui quando o social clica "Agendado".
4. **Concluído** (status `PUBLISHED`) — o admin clica **"✓ Concluído"** no card programado (confirma que foi ao ar). Some do dashboard 10 dias após `postedAt`.

## Colunas do dashboard

`Ajustes → Revisão interna → Aguardando cliente → Prontos p/ programar → Posts programados → Concluído → Rascunho`

- readyToSchedule = `APPROVED`
- **scheduled = `SCHEDULED`** (novo)
- published = `PUBLISHED` (coluna minimizada, some 10 dias após conclusão)

## Mudanças técnicas

- **Novo status `SCHEDULED`** em `ContentItem.status` (campo é `String`, sem migração).
- **`/api/programar/[clientId]` PATCH ("Agendado")**: passa a setar `status="SCHEDULED"` (hoje seta `PUBLISHED` + `postedAt`). Propaga ao grupo do carrossel.
- **`/api/programar/[clientId]` GET**: filtro simplificado — `APPROVED`, `postedAt: null`, `contentType != TEXTO`, do cliente. (Remove a dependência de `sentToProgramacaoAt`.)
- **Dashboard (`page.tsx`)**: etapa "Posts programados"; seletor de data grava `scheduledDate`; selo de dias esperando; botão "✓ Concluído" nos cards programados.
- **Menu ⋯ (`PostActionsMenu`)**: entra "🔗 Copiar link da programação"; sai "📅 Enviar p/ programação".
- **Novo componente `PostDatePicker`** (seletor de data inline; PATCH `scheduledDate`).
- **Faxina (Fase B)**: remove "Programação" do `AdminNav`; deleta `/admin/programacao/page.tsx` e `ProgramacaoKanban.tsx`.
- Fora de escopo: Planner de arrastar (usuário escolheu seletor de data no card). `/admin/planner` fica como está (não está na nav).

## Fases

- **Fase A** — fluxo novo funcionando: status `SCHEDULED`, etapa "Posts programados", seletor de data, link no menu, dias esperando, botão "✓ Concluído".
- **Fase B** — faxina: remove nav/página/`ProgramacaoKanban`; simplifica `/programar`.
