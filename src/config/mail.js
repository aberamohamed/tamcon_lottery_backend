import nodemailer from 'nodemailer';
import { env } from './env.js';

let transporter;

export function getMailTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_SECURE,
      auth:
        env.MAIL_USER && env.MAIL_PASS
          ? {
            user: env.MAIL_USER,
            pass: env.MAIL_PASS,
          }
          : undefined,
    });
  }
  return transporter;
}
