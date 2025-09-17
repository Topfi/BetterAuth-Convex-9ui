import type { RunMutationCtx } from "@convex-dev/better-auth";

import { internal } from "../../_generated/api";
import type { UserDataDeletionHandler } from "@shared/userData";

type RegisterPurger = (
  domain: string,
  handler: UserDataDeletionHandler<RunMutationCtx>,
) => void;

export const registerAllUserDataPurgers = (register: RegisterPurger) => {
  register("counter", async (ctx, userId) => {
    const deletedRecords = await ctx.runMutation(
      internal.features.counter.deleteForUser,
      {
        userId,
      },
    );

    return { deletedRecords };
  });
  register("auditLogs", async (ctx, userId) => {
    const deletedRecords = await ctx.runMutation(internal.logs.deleteForUser, {
      userId,
    });

    return { deletedRecords };
  });
  register("appUsers", async (ctx, userId) => {
    const deletedRecords = await ctx.runMutation(
      internal.features.authDomain.appUsers.deleteForAuthUser,
      {
        authUserId: userId,
      },
    );

    return { deletedRecords };
  });
};
