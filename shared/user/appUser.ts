import { z } from "zod";

import { displayUsernameSchema, normalizedUsernameSchema } from "../auth";

export const appUserIdSchema = z.string().min(1, "Auth user id is required");

export const appUserDocumentSchema = z.object({
  authUserId: appUserIdSchema,
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  displayUsername: displayUsernameSchema.optional(),
  username: normalizedUsernameSchema.optional(),
  image: z.string().min(1).optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export type AppUserDocument = z.infer<typeof appUserDocumentSchema>;

export const sanitizeAppUserDocument = (
  payload: AppUserDocument,
): AppUserDocument => {
  const sanitized = appUserDocumentSchema.parse(payload);
  return sanitized;
};

export type BetterAuthUserLike = {
  id?: string | null;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  displayUsername?: string | null;
  username?: string | null;
  image?: string | null;
  createdAt?: number | Date | null;
  updatedAt?: number | Date | null;
};

const normalizeTimestamp = (
  value: number | Date | null | undefined,
): number => {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return Date.now();
};

const normalizeNullableString = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const mapAuthUserToAppUserDocument = (
  user: BetterAuthUserLike,
): AppUserDocument => {
  const createdAt = normalizeTimestamp(user.createdAt ?? null);
  const updatedAt = normalizeTimestamp(user.updatedAt ?? createdAt);
  const authUserId =
    normalizeNullableString(user.id ?? user.userId ?? null) ?? "unknown-user";

  return sanitizeAppUserDocument({
    authUserId,
    email: normalizeNullableString(user.email ?? null),
    name: normalizeNullableString(user.name ?? null),
    displayUsername: normalizeNullableString(user.displayUsername ?? null),
    username: normalizeNullableString(user.username ?? null),
    image: normalizeNullableString(user.image ?? null),
    createdAt,
    updatedAt,
  });
};
