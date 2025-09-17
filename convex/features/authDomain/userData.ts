import type { RunMutationCtx } from "@convex-dev/better-auth";

import {
  createUserDataDeletionRegistry,
  type UserDataDeletionDetails,
  type UserDataDeletionHandler,
} from "@shared/userData";
import { registerAllUserDataPurgers } from "./userDataRegistrations";

const registry = createUserDataDeletionRegistry<RunMutationCtx>();

export const registerUserDataPurger = (
  domain: string,
  handler: UserDataDeletionHandler<RunMutationCtx>,
) => {
  registry.register(domain, handler);
};

registerAllUserDataPurgers(registerUserDataPurger);

export const deleteAllUserData = async (
  ctx: RunMutationCtx,
  userId: string,
): Promise<UserDataDeletionDetails[]> => {
  return registry.run(ctx, userId);
};

export const getRegisteredUserDataDomains = () => {
  return registry.getDomains();
};
