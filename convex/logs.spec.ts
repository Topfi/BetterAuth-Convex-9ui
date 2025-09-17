import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuditLog, recordAuditLog } from "./logs";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { RunMutationCtx } from "@convex-dev/better-auth";
import {
  createAuditLogInput,
  makeAuditLogDocument,
} from "@shared/logging/audit";

vi.mock("@shared/logging/audit", async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import("@shared/logging/audit");
  return {
    ...actual,
    makeAuditLogDocument: vi.fn(actual.makeAuditLogDocument),
  } satisfies typeof import("@shared/logging/audit");
});

const mocked = vi.mocked(makeAuditLogDocument);

describe("createAuditLog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes documents using the provided context", async () => {
    const insert = vi.fn(async () => "id");
    const ctx = { db: { insert } } as unknown as MutationCtx;

    const createdAt = 1_700_000_000_000;
    vi.setSystemTime(createdAt);

    const input = createAuditLogInput({
      event: "account.deleted",
      userId: "user_123",
      details: { deletedDomains: [] },
    });

    await createAuditLog(ctx, input);

    expect(mocked).toHaveBeenCalledWith(input, createdAt);
    expect(insert).toHaveBeenCalledWith(
      "auditLogs",
      mocked.mock.results[0]?.value,
    );
  });
});

describe("recordAuditLog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the internal mutation when provided a RunMutationCtx", async () => {
    const runMutation = vi.fn(async () => undefined);
    const ctx = { runMutation } as unknown as RunMutationCtx;

    const payload = {
      event: "user.profile.updated" as const,
      userId: "user_123",
      actorId: "actor_456",
      details: { changedFields: ["displayName"] },
    };

    const expectedInput = createAuditLogInput(payload);

    await recordAuditLog(ctx, payload);

    expect(runMutation).toHaveBeenCalledWith(internal.logs.recordAudit, {
      input: expectedInput,
    });
  });

  it("writes documents directly when provided a MutationCtx", async () => {
    const insert = vi.fn(async () => "id");
    const ctx = { db: { insert } } as unknown as MutationCtx;

    const createdAt = 1_700_000_000_000;
    vi.setSystemTime(createdAt);

    const payload = {
      event: "user.profile.update_failed" as const,
      userId: "user_123",
      details: {
        changedFields: ["displayName"],
        errorCode: "rate_limited",
        message: "Rate limit exceeded",
      },
    };

    const expectedInput = createAuditLogInput(payload);

    await recordAuditLog(ctx, payload);

    expect(mocked).toHaveBeenCalledWith(expectedInput, createdAt);
    const document = mocked.mock.results[mocked.mock.results.length - 1]?.value;
    if (!document) {
      throw new Error("Expected audit document to be defined");
    }
    expect(insert).toHaveBeenCalledWith("auditLogs", document);
  });
});
