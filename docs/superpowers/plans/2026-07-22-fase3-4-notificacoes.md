# Fase 3.4 — Notificações por cliente (link evergreen) — Plan

**Goal:** Religar o envio automático ao cliente no modelo novo: um botão **"Notificar cliente"** no workspace do cliente que manda o **link fixo do cliente** (`/aprovar/[client.token]`) por WhatsApp (e e-mail se houver), citando quantos posts estão aguardando aprovação.

**Architecture:** Novo endpoint `POST /api/admin/clients/[id]/notify` (auth-gated) reusa `sendWhatsApp` + nodemailer inline (padrão do `resend`/`send-client`). Botão no header do workspace. As rotas antigas de notificação (campanha) ficam para a Fase 4 (limpeza); os links antigos já redirecionam.

## Global Constraints
- Deploy incremental (o pacote já está no ar; esta fase sobe em seguida).
- Reusa `sendWhatsApp(to, text)` de `@/lib/whatsapp` e `process.env.NEXTAUTH_URL` p/ montar o link.
- Envia WhatsApp se `client.whatsapp`; e-mail se `client.email`. Não falha a request se um canal der erro (try/catch).
- `npx tsc --noEmit` + `npm run build`. NÃO `npm run lint`.

## Task 1: `POST /api/admin/clients/[id]/notify`
- Create `src/app/api/admin/clients/[id]/notify/route.ts`.
- Auth-gated. Carrega client (name, whatsapp, email, token) + conta posts `status="CLIENT_REVIEW"`.
- Link: `${process.env.NEXTAUTH_URL}/aprovar/${client.token}`.
- WhatsApp (se whatsapp): "Olá {name}! Você tem {n} post(s) para aprovar: {link} — BRJ Mídias".
- E-mail (se email): nodemailer inline (mesmo transporter do `resend/route.ts`), corpo com o link.
- Retorna `{ sent: { whatsapp, email }, pending: n }`. 404 se cliente não existe.

## Task 2: Botão "Notificar cliente" no workspace
- Em `src/app/admin/(protected)/clients/[id]/page.tsx`, no header (perto de "Copiar link do cliente"), botão **"📨 Notificar cliente"** → `POST /api/admin/clients/[id]/notify`; feedback "Enviado!" / alerta de erro; desabilita enquanto envia.

## Task 3: tsc + build + commit + deploy

## Fora de escopo
- Cron de lembrete e limpeza das rotas antigas de notificação → Fase 4.
- Notificação da revisão interna (time usa o link interno copiável) → opcional depois.
