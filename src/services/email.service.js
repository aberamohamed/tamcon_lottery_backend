import { getMailTransporter } from '../config/mail.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// Check if we have valid SMTP credentials configured in our env.
function hasSmtpCredentials() {
  return Boolean(env.MAIL_USER?.trim() && env.MAIL_PASS?.trim());
}

// Decide if we should dump the OTP directly to the terminal instead of sending an actual email. Useful for dev mode.
export function shouldLogOtpToConsole() {
  if (env.MAIL_LOG_OTP_TO_CONSOLE) return true;
  if (env.NODE_ENV === 'development' && !hasSmtpCredentials()) return true;
  return false;
}

// Send the OTP code via email, or log it to the console if we're in dev mode without SMTP.
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

// Email the winner congratulating them and letting them know the amount won.
export async function sendWinnerEmail(to, prizeAmount) {
  if (shouldLogOtpToConsole()) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[WINNER EMAIL] ${to} → Won ${prizeAmount} ETB\n`,
    );
    return;
  }

  if (!hasSmtpCredentials()) {
    console.warn(`Winner email to ${to} skipped: Email is not configured.`);
    return;
  }

  const transporter = getMailTransporter();
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `Congratulations from ${env.APP_NAME}!`,
    text: `You just won ${prizeAmount.toLocaleString('en-US')} ETB in this week's lottery draw!`,
    html: `<p>Congratulations!</p><p>You just won <strong>${prizeAmount.toLocaleString('en-US')} ETB</strong> in this week's lottery draw!</p><p>Your wallet has been automatically credited.</p>`,
  });
}
