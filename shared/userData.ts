export type UserDataDeletionDetails = {
  domain: string;
  deletedRecords?: number;
};

export type UserDataDeletionHandler<TContext> = (
  ctx: TContext,
  userId: string,
) =>
  | Promise<Omit<UserDataDeletionDetails, "domain"> | void>
  | Omit<UserDataDeletionDetails, "domain">
  | void;

export type UserDataDeletionRegistry<TContext> = {
  register: (
    domain: string,
    handler: UserDataDeletionHandler<TContext>,
  ) => void;
  run: (ctx: TContext, userId: string) => Promise<UserDataDeletionDetails[]>;
  getDomains: () => string[];
};

export const createUserDataDeletionRegistry = <
  TContext,
>(): UserDataDeletionRegistry<TContext> => {
  const handlers = new Map<string, UserDataDeletionHandler<TContext>>();

  return {
    register(domain, handler) {
      if (handlers.has(domain)) {
        throw new Error(
          `User data purger already registered for domain "${domain}"`,
        );
      }
      handlers.set(domain, handler);
    },
    async run(ctx, userId) {
      const results: UserDataDeletionDetails[] = [];
      for (const [domain, handler] of handlers) {
        const details = await handler(ctx, userId);
        if (details) {
          results.push({ domain, ...details });
        } else {
          results.push({ domain });
        }
      }
      return results;
    },
    getDomains() {
      return Array.from(handlers.keys());
    },
  };
};
