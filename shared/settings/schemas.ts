import { z } from "zod";

import {
  displayNameSchema,
  emailSchema,
  normalizedUsernameSchema,
  passphraseSchema,
  displayUsernameSchema,
} from "../auth";

export const accountProfileUpdateSchema = z.object({
  displayUsername: displayUsernameSchema,
  username: normalizedUsernameSchema,
  name: displayUsernameSchema,
  image: z
    .union([
      z.string().min(1, { message: "Provide a valid image." }),
      z.literal(null),
    ])
    .optional(),
});

export const accountEmailChangeSchema = z.object({
  email: emailSchema,
  callbackUrl: z
    .string()
    .url({ message: "Callback URL must be a valid URL." })
    .optional(),
});

export const passphraseUpdateSchema = z
  .object({
    currentPassphrase: passphraseSchema,
    nextPassphrase: passphraseSchema,
    confirmPassphrase: passphraseSchema,
  })
  .refine((values) => values.nextPassphrase === values.confirmPassphrase, {
    message: "Passphrases must match.",
    path: ["confirmPassphrase"],
  })
  .refine((values) => values.currentPassphrase !== values.nextPassphrase, {
    message: "Use a new passphrase.",
    path: ["nextPassphrase"],
  });

export const deleteAccountConfirmationSchema = z.object({
  confirmation: displayNameSchema,
});

export const dataExportRequestSchema = z.object({
  acknowledgeDelay: z.literal(true, {
    message: "Confirm the 24 hour export window.",
  }),
});

export type AccountProfileUpdateInput = z.infer<
  typeof accountProfileUpdateSchema
>;
export type AccountEmailChangeInput = z.infer<typeof accountEmailChangeSchema>;
export type PassphraseUpdateInput = z.infer<typeof passphraseUpdateSchema>;
export type DeleteAccountConfirmationInput = z.infer<
  typeof deleteAccountConfirmationSchema
>;
export type DataExportRequestInput = z.infer<typeof dataExportRequestSchema>;
