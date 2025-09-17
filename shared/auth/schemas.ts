import { z } from "zod";

import { validatePassphrase } from "./passphrasePolicy";
import {
  displayUsernameSchema as sharedDisplayUsernameSchema,
  normalizeUsername,
  normalizedUsernameSchema,
  usernameInputSchema,
} from "./username";

const maxNameLength = 64;

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter your email." })
  .email({ message: "Enter a valid email address." })
  .transform((value) => value.toLowerCase());

export const passphraseSchema = z
  .string()
  .min(1, { message: "Enter your passphrase." })
  .superRefine((value, ctx) => {
    const { failures } = validatePassphrase(value);
    failures.forEach((failure) => {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: failure.message,
      });
    });
  });

export const otpSchema = z.string().regex(/^[0-9]{6}$/u, {
  message: "Enter the 6-digit verification code.",
});

const identifierRequiredMessage = "Enter your email or username.";

export const signInIdentifierSchema = z
  .string()
  .trim()
  .min(1, { message: identifierRequiredMessage })
  .transform((rawValue, ctx) => {
    const emailResult = emailSchema.safeParse(rawValue);
    if (emailResult.success) {
      return {
        kind: "email" as const,
        value: emailResult.data,
      };
    }

    const usernameResult = usernameInputSchema.safeParse(rawValue);
    if (usernameResult.success) {
      return {
        kind: "username" as const,
        value: normalizeUsername(usernameResult.data),
      };
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid email address or username.",
    });
    return z.NEVER;
  });

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Provide a display name." })
  .max(maxNameLength * 2, {
    message: `Display name must be ${maxNameLength * 2} characters or fewer.`,
  });

const signInWithEmailSchema = z.object({
  email: emailSchema,
  passphrase: passphraseSchema,
});

const signInWithUsernameSchema = z.object({
  username: usernameInputSchema.transform(normalizeUsername),
  passphrase: passphraseSchema,
});

export const signInWithPassphraseSchema = z.union([
  signInWithEmailSchema,
  signInWithUsernameSchema,
]);

export const signInOtpVerificationSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

export const requestPassphraseResetSchema = z.object({
  email: emailSchema,
  redirectTo: z
    .string()
    .url({ message: "Reset destination must be a valid URL." }),
});

export const signUpRequestSchema = z.object({
  email: emailSchema,
  passphrase: passphraseSchema,
  username: normalizedUsernameSchema,
  displayUsername: sharedDisplayUsernameSchema,
  name: sharedDisplayUsernameSchema,
  image: z
    .string()
    .min(1, { message: "Profile image must be encoded as base64." })
    .optional(),
});

export type EmailValue = z.infer<typeof emailSchema>;
export type PassphraseValue = z.infer<typeof passphraseSchema>;
export type OtpValue = z.infer<typeof otpSchema>;
export type SignInWithPassphraseInput = z.infer<
  typeof signInWithPassphraseSchema
>;
export type SignInIdentifier = z.infer<typeof signInIdentifierSchema>;
export type SignInOtpVerificationInput = z.infer<
  typeof signInOtpVerificationSchema
>;
export type RequestPassphraseResetInput = z.infer<
  typeof requestPassphraseResetSchema
>;
export type SignUpRequestInput = z.infer<typeof signUpRequestSchema>;
