import { getMailTransporter } from '../config/mail.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Checks if the application has SMTP credentials configured.
 * 
 * @returns {boolean} True if both MAIL_USER and MAIL_PASS are set, false otherwise.
 */
function hasSmtpCredentials() {
  return Boolean(env.MAIL_USER?.trim() && env.MAIL_PASS?.trim());
}

/**
 * Determines whether the OTP should be logged to the console instead of emailed.
 * This is useful for development environments without an SMTP setup.
 * 
 * @returns {boolean} True if the OTP should be logged to the console.
 */
export function shouldLogOtpToConsole() {
  if (env.MAIL_LOG_OTP_TO_CONSOLE) return true;
  if (env.NODE_ENV === 'development' && !hasSmtpCredentials()) return true;
  return false;
}

/**
 * Sends an OTP email to the specified address.
 * Falls back to logging the OTP to the console if configured.
 * 
 * @param {string} to - The recipient's email address.
 * @param {string} otp - The one-time password to send.
 * @returns {Promise<void>}
 * @throws {ApiError} If email is not configured and console logging is not enabled.
 */
export async function sendOtpEmail(to, otp) {
  if (shouldLogOtpToConsole()) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[OTP] ${to} → ${otp} (expires in ${env.OTP_EXPIRES_MINUTES} minutes)\n`,
    );
    return;
  }

  if (!hasSmtpCredentials()) {
    throw new ApiError(
      503,
      'Email is not configured. Set MAIL_USER and MAIL_PASS, or enable MAIL_LOG_OTP_TO_CONSOLE for development.',
    );
  }

  const transporter = getMailTransporter();
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `${env.APP_NAME} — your login code`,
    text: `Your one-time code is ${otp}. It expires in ${env.OTP_EXPIRES_MINUTES} minutes.`,
    html: `<p>Your one-time code is <strong>${otp}</strong>.</p><p>It expires in ${env.OTP_EXPIRES_MINUTES} minutes.</p>`,
  });
}
