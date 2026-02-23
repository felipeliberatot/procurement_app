import nodemailer from "nodemailer";

// ─── E-mail Service ───────────────────────────────────────────────────────────
// Uses SMTP credentials from environment variables.
// Supports Gmail (SMTP_HOST=smtp.gmail.com, SMTP_PORT=587) or other providers.

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("[Email] SMTP not configured — skipping email send.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

const FROM_NAME = process.env.SMTP_FROM_NAME ?? "CGS Agropecuária";
const FROM_EMAIL = process.env.SMTP_USER ?? "noreply@cgs.agr.br";

export async function sendWelcomeEmail(params: {
  toEmail: string;
  toName: string;
  jobTitle?: string;
  loginUrl?: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  const loginUrl = params.loginUrl ?? "https://procurement.cgs.agr.br";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao Sistema de Compras</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#0a7ea4;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">🌾 CGS Agropecuária</h1>
              <p style="margin:6px 0 0;color:#e0f4fb;font-size:14px;">Sistema de Gestão de Compras</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#11181C;font-size:18px;">Olá, ${params.toName}! 👋</h2>
              <p style="margin:0 0 16px;color:#687076;font-size:14px;line-height:1.6;">
                Sua conta foi criada no <strong>Sistema de Gestão de Compras da CGS Agropecuária</strong>.
                ${params.jobTitle ? `Você foi cadastrado como <strong>${params.jobTitle}</strong>.` : ""}
              </p>
              <p style="margin:0 0 24px;color:#687076;font-size:14px;line-height:1.6;">
                Para acessar o sistema, clique no botão abaixo e faça login com seu e-mail corporativo:
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:#0a7ea4;border-radius:8px;padding:14px 28px;text-align:center;">
                    <a href="${loginUrl}" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
                      Acessar o Sistema →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#687076;font-size:13px;">
                Ou copie e cole este link no seu navegador:
              </p>
              <p style="margin:0 0 24px;color:#0a7ea4;font-size:13px;word-break:break-all;">
                ${loginUrl}
              </p>
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
              <p style="margin:0;color:#9BA1A6;font-size:12px;text-align:center;">
                Este e-mail foi enviado automaticamente pelo sistema. Não responda a este e-mail.<br/>
                Em caso de dúvidas, entre em contato com o administrador do sistema.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: params.toEmail,
      subject: "Bem-vindo ao Sistema de Compras — CGS Agropecuária",
      html,
      text: `Olá, ${params.toName}!\n\nSua conta foi criada no Sistema de Gestão de Compras da CGS Agropecuária.\n\nAcesse: ${loginUrl}\n\nEm caso de dúvidas, entre em contato com o administrador.`,
    });
    console.log(`[Email] Welcome email sent to ${params.toEmail}`);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send welcome email:", err);
    return false;
  }
}
