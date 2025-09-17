import { describe, expect, it } from "vitest";

import {
  createAuditLogInput,
  makeAuditLogDocument,
  normalizeDeletedDomains,
} from "./audit";
import type { UserDataDeletionDetails } from "../userData";

const sampleDomains: UserDataDeletionDetails[] = [
  { domain: "counter", deletedRecords: 3 },
  { domain: "auditLogs" },
];

describe("normalizeDeletedDomains", () => {
  it("preserves provided domains while omitting undefined counts", () => {
    expect(normalizeDeletedDomains(sampleDomains)).toEqual([
      { domain: "counter", deletedRecords: 3 },
      { domain: "auditLogs" },
    ]);
  });
});

describe("createAuditLogInput", () => {
  it("constructs a valid account deletion payload", () => {
    const input = createAuditLogInput({
      event: "account.deleted",
      userId: "user_123",
      details: {
        deletedDomains: normalizeDeletedDomains(sampleDomains),
      },
    });

    expect(input).toEqual({
      event: "account.deleted",
      userId: "user_123",
      actorId: "user_123",
      ipAddress: undefined,
      details: {
        deletedDomains: normalizeDeletedDomains(sampleDomains),
      },
    });
  });

  it("supports sign-in failure metadata", () => {
    const input = createAuditLogInput({
      event: "auth.sign_in.failure",
      userId: "unknown",
      actorId: "unknown",
      ipAddress: "203.0.113.24",
      details: {
        method: "email",
        errorCode: "INVALID_CREDENTIALS",
        message: "Invalid passphrase",
      },
    });

    expect(input.details.method).toBe("email");
    expect(input.details.errorCode).toBe("INVALID_CREDENTIALS");
    expect(input.ipAddress).toBe("203.0.113.24");
  });
});

describe("makeAuditLogDocument", () => {
  it("returns a document ready for Convex insertion", () => {
    const createdAt = 1_700_000_000_000;
    const input = createAuditLogInput({
      event: "user.profile.updated",
      userId: "user_123",
      details: {
        changedFields: ["displayUsername", "image"],
      },
    });

    const document = makeAuditLogDocument(input, createdAt);

    expect(document).toEqual({
      event: "user.profile.updated",
      userId: "user_123",
      actorId: "user_123",
      createdAt,
      details: {
        changedFields: ["displayUsername", "image"],
      },
      ipAddress: undefined,
    });
  });
});
