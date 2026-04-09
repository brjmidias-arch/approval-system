import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: { client: true },
  });

  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

  const approvalUrl = `${process.env.NEXTAUTH_URL}/aprovar/${campaign.token}`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "BRJ Mídias <noreply@brjmidias.com.br>",
    to: campaign.client.email,
    subject: `[BRJ Mídias] Conteúdo aguardando sua aprovação — ${campaign.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2>Olá, ${campaign.client.name}!</h2>
        <p>Seu conteúdo de <strong>${campaign.name}</strong> está pronto para revisão.</p>
        <p>Clique no botão abaixo para visualizar e aprovar os posts:</p>
        <a href="${approvalUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Revisar Conteúdo
        </a>
        <p style="color:#666;font-size:14px;margin-top:24px;">
          Ou acesse: <a href="${approvalUrl}">${approvalUrl}</a>
        </p>
        <p style="color:#666;font-size:14px;">
          Este link expira em ${new Date(campaign.expiresAt).toLocaleDateString("pt-BR")}.
        </p>
        <hr/>
        <p style="color:#999;font-size:12px;">BRJ Mídias — brjmidias.com.br</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}
