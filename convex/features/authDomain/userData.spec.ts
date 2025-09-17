import { describe, expect, it, vi } from "vitest";
import type { RunMutationCtx } from "@convex-dev/better-auth";

import { deleteAllUserData, getRegisteredUserDataDomains } from "./userData";
import { internal } from "../../_generated/api";

describe("account deletion purgers", () => {
  it("purges counter data when a user is deleted", async () => {
    const runMutation = vi.fn().mockResolvedValue(2);
    const ctx = {
      runMutation,
      runQuery: vi.fn(),
    } satisfies RunMutationCtx;

    const details = await deleteAllUserData(ctx, "user_123");

    expect(runMutation).toHaveBeenNthCalledWith(
      1,
      internal.features.counter.deleteForUser,
      {
        userId: "user_123",
      },
    );
    expect(runMutation).toHaveBeenNthCalledWith(
      2,
      internal.logs.deleteForUser,
      {
        userId: "user_123",
      },
    );
    expect(runMutation).toHaveBeenNthCalledWith(
      3,
      internal.features.authDomain.appUsers.deleteForAuthUser,
      {
        authUserId: "user_123",
      },
    );
    expect(details).toEqual([
      {
        domain: "counter",
        deletedRecords: 2,
      },
      {
        domain: "auditLogs",
        deletedRecords: 2,
      },
      {
        domain: "appUsers",
        deletedRecords: 2,
      },
    ]);
  });

  it("records domains participating in account data purging", () => {
    expect(getRegisteredUserDataDomains()).toEqual([
      "counter",
      "auditLogs",
      "appUsers",
    ]);
  });
});
