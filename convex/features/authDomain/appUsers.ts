import { v } from "convex/values";

import { internalMutation, type MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  mapAuthUserToAppUserDocument,
  type AppUserDocument,
  type BetterAuthUserLike,
} from "@shared/user/appUser";

const trackedFields: Array<keyof AppUserDocument> = [
  "email",
  "name",
  "displayUsername",
  "username",
  "image",
];

const computeChangedFields = (
  previous: Doc<"appUsers"> | AppUserDocument | null,
  next: AppUserDocument,
): string[] => {
  if (!previous) {
    return trackedFields.filter(
      (field) => next[field] !== null && next[field] !== undefined,
    );
  }

  const beforeRecord = previous as Record<string, unknown>;
  const afterRecord = next as Record<string, unknown>;

  return trackedFields.filter((field) => {
    const beforeValue = beforeRecord[field as string] ?? null;
    const afterValue = afterRecord[field as string] ?? null;
    return beforeValue !== afterValue;
  });
};

const upsertInternal = async (
  ctx: MutationCtx,
  authUser: BetterAuthUserLike,
): Promise<{
  doc: Doc<"appUsers">;
  prior: Doc<"appUsers"> | null;
  changedFields: string[];
}> => {
  const normalized = mapAuthUserToAppUserDocument(authUser);
  const existing = await ctx.db
    .query("appUsers")
    .withIndex("authUserId", (q) => q.eq("authUserId", normalized.authUserId))
    .first();

  const changedFields = computeChangedFields(existing, normalized);

  if (!existing) {
    const id: Id<"appUsers"> = await ctx.db.insert("appUsers", normalized);
    const created = await ctx.db.get(id);
    if (!created) {
      throw new Error("Failed to persist application user profile");
    }
    return { doc: created, prior: null, changedFields };
  }

  const { createdAt } = existing;
  await ctx.db.patch(existing._id, {
    ...normalized,
    createdAt,
  });

  const updated = await ctx.db.get(existing._id);
  if (!updated) {
    throw new Error("Application user profile was unexpectedly removed");
  }

  return { doc: updated, prior: existing, changedFields };
};

export const syncFromAuthUser = async (
  ctx: MutationCtx,
  authUser: BetterAuthUserLike,
) => {
  return upsertInternal(ctx, authUser);
};

export const previewChangedFields = (
  previous: BetterAuthUserLike | null,
  next: BetterAuthUserLike,
): string[] => {
  const nextDocument = mapAuthUserToAppUserDocument(next);
  const priorDocument = previous
    ? mapAuthUserToAppUserDocument(previous)
    : null;
  return computeChangedFields(priorDocument, nextDocument);
};

export const deleteForAuthUser = internalMutation({
  args: {
    authUserId: v.string(),
  },
  handler: async (ctx, { authUserId }) => {
    const records = await ctx.db
      .query("appUsers")
      .withIndex("authUserId", (q) => q.eq("authUserId", authUserId))
      .collect();

    for (const record of records) {
      await ctx.db.delete(record._id);
    }

    return records.length;
  },
});
