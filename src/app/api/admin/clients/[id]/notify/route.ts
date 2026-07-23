import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";
import nodemailer from "nodemailer";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, whatsapp: true, token: true },
  });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  if (!client.token) return NextResponse.json({ error: "Cliente sem link de aprovação" }, { status: 400 });

  const pending = await prisma.contentItem.count({ where: { clientId: client.id, status: "CLIENT_REVIEW" } });
  const approvalUrl = `${process.env.NEXTAUTH_URL}/aprovar/${client.token}`;
  const nLabel = pending === 1 ? "1 post" : `${pending} posts`;

  const sent = { whatsapp: false, email: false };

  // WhatsApp (não bloqueia a request se falhar)
  if (client.whatsapp) {
    try {
      const msg =
        `Olá, ${client.name}! 🎨\n\n` +
        `Você tem *${nLabel}* aguardando sua aprovação.\n\n` +
        `Acesse o link para aprovar ou solicitar ajustes:\n${approvalUrl}\n\n` +
        `_BRJ Mídias_`;
      await sendWhatsApp(client.whatsapp, msg);
      sent.whatsapp = true;
    } catch (err) {
      console.error("Erro ao enviar WhatsApp:", err);
    }
  }

  // E-mail (não bloqueia a request se falhar)
  if (client.email) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "BRJ Mídias <noreply@brjmidias.com.br>",
        to: client.email,
        subject: `[BRJ Mídias] Conteúdo aguardando sua aprovação`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2>Olá, ${escapeHtml(client.name)}!</h2>
            <p>Você tem <strong>${nLabel}</strong> aguardando sua aprovação.</p>
            <a href="${approvalUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Revisar Conteúdo
            </a>
            <p style="color:#666;font-size:14px;margin-top:24px;">Ou acesse: <a href="${approvalUrl}">${approvalUrl}</a></p>
            <hr/>
            <p style="color:#999;font-size:12px;">BRJ Mídias — brjmidias.com.br</p>
          </div>
        `,
      });
      sent.email = true;
    } catch (err) {
      console.error("Erro ao enviar e-mail:", err);
    }
  }

  return NextResponse.json({ sent, pending });
}
