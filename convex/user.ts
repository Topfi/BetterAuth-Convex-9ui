import { mutation } from "./_generated/server";

export const ensureUsername = mutation({
  args: {},
  handler: async () => {
    return { updated: false };
  },
});
