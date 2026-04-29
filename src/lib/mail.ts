import nodemailer from "nodemailer";

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "—";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface ApprovalSummary {
  clientName: string;
  campaignName: string;
  approved: number;
  adjustment: number;
  rejected: number;
  items: {
    caption: string | null;
    contentType: string;
    status: string;
    clientComment: string | null;
  }[];
}

export async function sendApprovalNotification(summary: ApprovalSummary) {
  const statusLabel: Record<string, string> = {
    APPROVED: "✅ Aprovado",
    ADJUSTMENT: "✏️ Ajuste Solicitado",
    REJECTED: "❌ Reprovado",
    PENDING: "⏳ Pendente",
  };

  const itemsHtml = summary.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.contentType.replace("_", " "))}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.caption)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${statusLabel[item.status] || escapeHtml(item.status)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.clientComment)}</td>
      </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto;">
      <h2 style="color:#0f0f0f;">📋 Revisão de Conteúdo Finalizada</h2>
      <p><strong>Cliente:</strong> ${escapeHtml(summary.clientName)}</p>
      <p><strong>Campanha:</strong> ${escapeHtml(summary.campaignName)}</p>
      <hr/>
      <h3>Resumo</h3>
      <ul>
        <li>✅ Aprovados: <strong>${summary.approved}</strong></li>
        <li>✏️ Com ajuste: <strong>${summary.adjustment}</strong></li>
        <li>❌ Reprovados: <strong>${summary.rejected}</strong></li>
      </ul>
      <hr/>
      <h3>Detalhes por item</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Tipo</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Legenda</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Status</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Comentário</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "BRJ Mídias <noreply@brjmidias.com.br>",
    to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
    subject: `[BRJ Mídias] Revisão finalizada — ${summary.clientName} | ${summary.campaignName}`,
    html,
  });
}
