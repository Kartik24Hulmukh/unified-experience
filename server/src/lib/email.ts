/**
 * BErozgar — Email Delivery
 *
 * Three providers:
 *   • log    — console-only (dev)
 *   • resend — Resend API (recommended for production)
 *   • smtp   — Nodemailer SMTP (fallback)
 *
 * All providers share retry logic (3 attempts, exponential backoff)
 * and a 10 s per-attempt timeout.
 */

import { env } from '@/config/env';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

/* ─── Interfaces ──────────────────────────────── */

export interface OtpEmailPayload {
  to: string;
  otp: string;
  expiresInMinutes: number;
}

interface EmailProvider {
  sendOtp(payload: OtpEmailPayload): Promise<void>;
}

/* ─── Constants ───────────────────────────────── */

const MAX_RETRIES = 3;
const TIMEOUT_MS = 10_000;
const RETRY_BASE_MS = 500;

/* ─── OTP HTML Template ──────────────────────── */

function otpHtml(otp: string, expiresMin: number): string {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#ffffff">
  <div style="max-width:480px;margin:40px auto;padding:40px;border:1px solid rgba(255,255,255,0.1);background:#111111">
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.02em;margin:0">BErozgar</h1>
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-top:8px">Campus Trust Exchange</p>
    </div>
    <div style="text-align:center;padding:32px 0;border-top:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05)">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.5);margin:0 0 16px">Your Verification Code</p>
      <div style="font-size:36px;font-weight:800;letter-spacing:0.3em;color:#00d4aa;font-family:'Courier New',monospace">${otp}</div>
    </div>
    <p style="font-size:12px;color:rgba(255,255,255,0.4);text-align:center;margin-top:24px">
      This code expires in <strong style="color:#ffffff">${expiresMin} minutes</strong>.
      If you did not request this, please ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/* ─── Helpers ────────────────────────────────── */

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Email send timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: Error | undefined;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await withTimeout(fn(), TIMEOUT_MS);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Email] ${label} attempt ${attempt}/${MAX_RETRIES} failed: ${lastErr.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastErr!;
}

/* ─── Providers ─────────────────────────────── */

class LogEmailProvider implements EmailProvider {
  async sendOtp(payload: OtpEmailPayload): Promise<void> {
    const redactedOtp = env.NODE_ENV === 'production' ? '******' : payload.otp;
    console.info(
      `[Email:log] OTP → to=${payload.to} otp=${redactedOtp} ttl=${payload.expiresInMinutes}min`,
    );
  }
}

class ResendEmailProvider implements EmailProvider {
  private client: Resend;

  constructor() {
    if (!env.RESEND_API_KEY) {
      throw new Error('EMAIL_PROVIDER=resend but RESEND_API_KEY is missing');
    }
    this.client = new Resend(env.RESEND_API_KEY);
  }

  async sendOtp(payload: OtpEmailPayload): Promise<void> {
    await withRetry(async () => {
      const { error } = await this.client.emails.send({
        from: env.EMAIL_FROM,
        to: [payload.to],
        subject: `${payload.otp} — BErozgar Verification Code`,
        html: otpHtml(payload.otp, payload.expiresInMinutes),
      });

      if (error) {
        throw new Error(`Resend API error: ${error.message}`);
      }
    }, `Resend→${payload.to}`);

    console.info(`[Email:resend] OTP delivered → ${payload.to}`);
  }
}

class SmtpEmailProvider implements EmailProvider {
  private transporter: Mail;

  constructor() {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      throw new Error('EMAIL_PROVIDER=smtp but SMTP_HOST/USER/PASS missing');
    }
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  async sendOtp(payload: OtpEmailPayload): Promise<void> {
    await withRetry(async () => {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to: payload.to,
        subject: `${payload.otp} — BErozgar Verification Code`,
        html: otpHtml(payload.otp, payload.expiresInMinutes),
      });
    }, `SMTP→${payload.to}`);

    console.info(`[Email:smtp] OTP delivered → ${payload.to}`);
  }
}

/* ─── Factory ────────────────────────────────── */

function createEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'resend': return new ResendEmailProvider();
    case 'smtp':   return new SmtpEmailProvider();
    default:       return new LogEmailProvider();
  }
}

const provider = createEmailProvider();

export async function sendOtpEmail(payload: OtpEmailPayload): Promise<void> {
  await provider.sendOtp(payload);
}

