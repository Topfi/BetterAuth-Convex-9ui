import { z } from "zod";

import type { UserDataDeletionDetails } from "../userData";

const auditLogEvents = [
  "account.deleted",
  "auth.sign_in.success",
  "auth.sign_in.failure",
  "auth.passphrase.changed",
  "auth.passphrase.failed",
  "auth.email.change.requested",
  "auth.email.change.failed",
  "user.profile.updated",
  "user.profile.update_failed",
] as const;

export const auditLogEventSchema = z.enum(auditLogEvents);
export type AuditLogEvent = (typeof auditLogEvents)[number];

export const auditLogDeletedDomainSchema = z.object({
  domain: z.string(),
  deletedRecords: z.number().int().nonnegative().optional(),
});
export type AuditLogDeletedDomain = z.infer<typeof auditLogDeletedDomainSchema>;

const accountDeletionDetailsSchema = z.object({
  deletedDomains: z.array(auditLogDeletedDomainSchema),
});

const signInSuccessDetailsSchema = z.object({
  method: z.string().min(1),
});

const signInFailureDetailsSchema = signInSuccessDetailsSchema.extend({
  errorCode: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
});

const passphraseChangedDetailsSchema = z.object({
  method: z.string().min(1),
});

const passphraseFailedDetailsSchema = passphraseChangedDetailsSchema.extend({
  errorCode: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
});

const emailChangeRequestedDetailsSchema = z.object({
  newEmail: z.string().email(),
});

const emailChangeFailedDetailsSchema = emailChangeRequestedDetailsSchema.extend(
  {
    errorCode: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
  },
);

const profileUpdatedDetailsSchema = z.object({
  changedFields: z.array(z.string().min(1)).nonempty(),
});

const profileUpdateFailedDetailsSchema = z.object({
  changedFields: z.array(z.string().min(1)).optional(),
  errorCode: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
});

const _auditLogDetailSchemas = {
  "account.deleted": accountDeletionDetailsSchema,
  "auth.sign_in.success": signInSuccessDetailsSchema,
  "auth.sign_in.failure": signInFailureDetailsSchema,
  "auth.passphrase.changed": passphraseChangedDetailsSchema,
  "auth.passphrase.failed": passphraseFailedDetailsSchema,
  "auth.email.change.requested": emailChangeRequestedDetailsSchema,
  "auth.email.change.failed": emailChangeFailedDetailsSchema,
  "user.profile.updated": profileUpdatedDetailsSchema,
  "user.profile.update_failed": profileUpdateFailedDetailsSchema,
} as const satisfies Record<AuditLogEvent, z.ZodTypeAny>;

const auditLogBaseSchema = z.object({
  userId: z.string().min(1),
  actorId: z.string().min(1),
  ipAddress: z.string().min(1).optional(),
});

const auditLogInputSchema = z.union([
  auditLogBaseSchema.extend({
    event: z.literal("account.deleted"),
    details: accountDeletionDetailsSchema,
  }),
  auditLogBaseSchema.extend({
    event: z.literal("auth.sign_in.success"),
    details: signInSuccessDetailsSchema,
  }),
  auditLogBaseSchema.extend({
    event: z.literal("auth.sign_in.failure"),
    details: signInFailureDetailsSchema,
  }),
  auditLogBaseSchema.extend({
    event: z.literal("auth.passphrase.changed"),
    details: passphraseChangedDetailsSchema,
  }),
  auditLogBaseSchema.extend({
    event: z.literal("auth.passphrase.failed"),
    details: passphraseFailedDetailsSchema,
  }),
  auditLogBaseSchema.extend({
    event: z.literal("auth.email.change.requested"),
    details: emailChangeRequestedDetailsSchema,
  }),
  auditLogBaseSchema.extend({
    event: z.literal("auth.email.change.failed"),
    details: emailChangeFailedDetailsSchema,
  }),
  auditLogBaseSchema.extend({
    event: z.literal("user.profile.updated"),
    details: profileUpdatedDetailsSchema,
  }),
  auditLogBaseSchema.extend({
    event: z.literal("user.profile.update_failed"),
    details: profileUpdateFailedDetailsSchema,
  }),
]);

export type AuditLogInput = z.infer<typeof auditLogInputSchema>;

export type AuditLogDetailsMap = {
  [Event in AuditLogEvent]: z.infer<(typeof _auditLogDetailSchemas)[Event]>;
};

export type AuditLogDocument = {
  event: AuditLogEvent;
  userId: string;
  actorId: string;
  createdAt: number;
  details: AuditLogDetailsMap[AuditLogEvent];
  ipAddress?: string;
};

export const normalizeDeletedDomains = (
  details: readonly UserDataDeletionDetails[],
): AuditLogDeletedDomain[] => {
  return details.map((detail) => {
    const normalized: AuditLogDeletedDomain = { domain: detail.domain };
    if (
      typeof detail.deletedRecords === "number" &&
      Number.isFinite(detail.deletedRecords) &&
      detail.deletedRecords >= 0
    ) {
      normalized.deletedRecords = detail.deletedRecords;
    }
    return normalized;
  });
};

const sanitizeIpAddress = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const createAuditLogInput = <Event extends AuditLogEvent>({
  event,
  userId,
  actorId,
  ipAddress,
  details,
}: {
  event: Event;
  userId: string;
  actorId?: string;
  ipAddress?: string | null;
  details: AuditLogDetailsMap[Event];
}): AuditLogInput => {
  const schema = auditLogInputSchema;
  const parsed = schema.parse({
    event,
    userId,
    actorId: actorId ?? userId,
    ipAddress: sanitizeIpAddress(ipAddress),
    details,
  });
  return parsed as AuditLogInput;
};

export const makeAuditLogDocument = (
  input: AuditLogInput,
  createdAt: number,
): AuditLogDocument => {
  const parsed = auditLogInputSchema.parse(input);
  return {
    event: parsed.event,
    userId: parsed.userId,
    actorId: parsed.actorId,
    createdAt,
    details: parsed.details as AuditLogDetailsMap[AuditLogEvent],
    ipAddress: parsed.ipAddress,
  };
};
