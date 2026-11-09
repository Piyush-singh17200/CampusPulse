import "server-only";

import nodemailer from "nodemailer";

import { env } from "@/config/env";

export type PasswordResetEmailInput = {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter(): ReturnType<typeof nodemailer.createTransport> {
  if (!env.EMAIL_ENABLED) {
    throw new Error("Email delivery is not configured.");
  }

  if (!env.SMTP_HOST) {
    throw new Error("SMTP_HOST is not configured.");
  }

  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return transporter;
}

export function isEmailDeliveryConfigured(): boolean {
  return env.EMAIL_ENABLED;
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
  const text = [
    `Hi ${input.name},`,
    "",
    "We received a request to reset your CampusPulse password.",
    `Open this link to choose a new password: ${input.resetUrl}`,
    "",
    `This link expires in ${input.expiresInMinutes} minutes and can be used once.`,
    "If you did not request this, you can ignore this email. Your password has not changed.",
    "",
    "CampusPulse",
  ].join("\n");

  await getTransporter().sendMail({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: "Reset your CampusPulse password",
    text,
  });
}
