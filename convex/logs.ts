import type { RunMutationCtx } from "@convex-dev/better-auth";
import { v } from "convex/values";

import { internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  createAuditLogInput,
  makeAuditLogDocument,
  type AuditLogInput,
  type AuditLogEvent,
  type AuditLogDetailsMap,
  normalizeDeletedDomains,
} from "@shared/logging/audit";
import type { UserDataDeletionDetails } from "@shared/userData";

export const createAuditLog = async (
  ctx: MutationCtx,
  input: AuditLogInput,
): Promise<void> => {
  const document = makeAuditLogDocument(input, Date.now());
  await ctx.db.insert("auditLogs", document);
};

const auditLogInputValidator = v.object({
  event: v.string(),
  userId: v.string(),
  actorId: v.string(),
  ipAddress: v.optional(v.string()),
  details: v.object({
    deletedDomains: v.optional(
      v.array(
        v.object({
          domain: v.string(),
          deletedRecords: v.optional(v.number()),
        }),
      ),
    ),
    method: v.optional(v.string()),
    changedFields: v.optional(v.array(v.string())),
    errorCode: v.optional(v.string()),
    message: v.optional(v.string()),
    newEmail: v.optional(v.string()),
  }),
});

export const recordAudit = internalMutation({
  args: {
    input: auditLogInputValidator,
  },
  handler: async (ctx, { input }) => {
    await createAuditLog(ctx, input as AuditLogInput);
  },
});

export const deleteForUser = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("userIdCreatedAt", (q) => q.eq("userId", userId))
      .collect();

    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    return logs.length;
  },
});

export const recordAccountDeletionLog = async (
  ctx: RunMutationCtx,
  params: {
    userId: string;
    actorId?: string;
    ipAddress?: string | null;
    deletionDetails: readonly UserDataDeletionDetails[];
  },
): Promise<void> => {
  await recordAuditLog(ctx, {
    event: "account.deleted",
    userId: params.userId,
    actorId: params.actorId,
    ipAddress: params.ipAddress,
    details: {
      deletedDomains: normalizeDeletedDomains(params.deletionDetails),
    },
  });
};

export const recordAuditLog = async <Event extends AuditLogEvent>(
  ctx: RunMutationCtx | MutationCtx,
  payload: {
    event: Event;
    userId: string;
    actorId?: string;
    ipAddress?: string | null;
    details: AuditLogDetailsMap[Event];
  },
) => {
  const input = createAuditLogInput(payload);
  if ("runMutation" in ctx) {
    await ctx.runMutation(internal.logs.recordAudit, {
      input,
    });
    return;
  }
  await createAuditLog(ctx, input);
};

export type AuditLogDescriptor<Event extends AuditLogEvent> = {
  event: Event;
  userId: string;
  actorId?: string;
  ipAddress?: string | null;
  details: AuditLogDetailsMap[Event];
};

export const logAndThrow = async <
  Result,
  SuccessEvent extends AuditLogEvent,
  FailureEvent extends AuditLogEvent,
>(
  ctx: RunMutationCtx | MutationCtx,
  attempt: () => Promise<Result>,
  options: {
    onSuccess: (
      result: Result,
    ) => AuditLogDescriptor<SuccessEvent> | null | undefined;
    onError: (error: unknown) => AuditLogDescriptor<FailureEvent>;
  },
): Promise<Result> => {
  try {
    const result = await attempt();
    const descriptor = options.onSuccess(result);
    if (descriptor) {
      await recordAuditLog(ctx, descriptor);
    }
    return result;
  } catch (error) {
    try {
      await recordAuditLog(ctx, options.onError(error));
    } catch (loggingError) {
      console.error("Failed to record audit log", loggingError);
    }
    throw error;
  }
};
