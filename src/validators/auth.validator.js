// Zod schemas to validate, trim, and normalize input values for authentication actions.
import { z } from 'zod';

// Validate signup info: check email format, ensure name is not too short or empty.
export const createAccountSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase().trim()),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(160)
    .transform((n) => n.trim()),
});

// Ensure email matches valid standards before sending a new OTP login code.
export const requestOtpSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase().trim()),
});

// Verify the OTP code details: format the 6-digit number string and validate parameters.
export const verifyOtpSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase().trim()),
  otp: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim().padStart(6, '0'))
    .refine((v) => /^\d{6}$/.test(v), { message: 'OTP must be 6 digits' }),
  useHttpOnlyCookies: z.boolean().optional().default(false),
});

export const refreshBodySchema = z
  .object({
    refreshToken: z.string().min(10).optional(),
  })
  .strict();

export const refreshTokenBodySchema = z.object({}).strict().optional();
