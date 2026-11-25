import nodemailer, { type Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM,
  );
}

function getTransporter(): Transporter {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return cachedTransporter;
}

/**
 * Password reset OTP delivery. Phase 1 has no reset flow or OTP storage, so
 * this is the prepared integration point: when SMTP is not configured the OTP
 * is written to the server log instead of failing (development stub).
 *
 * Never log OTPs in production: configure SMTP before enabling a reset flow.
 */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (!isSmtpConfigured()) {
    console.info(
      `[email:stub] SMTP not configured. OTP for ${to} is ${code} (development only).`,
    );
    return;
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Your password reset code",
    text: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
  });
}
