import { v } from "convex/values";

import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getUserId } from "./auth";
import {
  applyCounterDelta,
  counterValueSchema,
  defaultCounterValue,
  type CounterValue,
} from "@shared/counter";

const ensureCounter = async (
  ctx: MutationCtx,
  userId: string,
): Promise<Doc<"counters">> => {
  const existing = await ctx.db
    .query("counters")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .first();

  if (existing) {
    return existing;
  }

  const now = Date.now();
  const id: Id<"counters"> = await ctx.db.insert("counters", {
    userId,
    value: defaultCounterValue.value,
    createdAt: now,
    updatedAt: now,
  });

  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("Failed to initialize counter");
  }

  return created;
};

export const get = query({
  args: {},
  handler: async (ctx): Promise<CounterValue | null> => {
    const userId = await getUserId(ctx);
    if (!userId) {
      return null;
    }

    const counter = await ctx.db
      .query("counters")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();

    if (!counter) {
      return defaultCounterValue;
    }

    return counterValueSchema.parse({ value: counter.value });
  },
});

export const increment = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const counterDoc = await ensureCounter(ctx, userId);
    const { value } = applyCounterDelta({ value: counterDoc.value }, 1);

    await ctx.db.patch(counterDoc._id, {
      value,
      updatedAt: Date.now(),
    });

    return counterValueSchema.parse({ value });
  },
});

export const decrement = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const counterDoc = await ensureCounter(ctx, userId);
    const { value } = applyCounterDelta({ value: counterDoc.value }, -1);

    await ctx.db.patch(counterDoc._id, {
      value,
      updatedAt: Date.now(),
    });

    return counterValueSchema.parse({ value });
  },
});

export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const counterDoc = await ensureCounter(ctx, userId);
    const { value } = defaultCounterValue;

    await ctx.db.patch(counterDoc._id, {
      value,
      updatedAt: Date.now(),
    });

    return counterValueSchema.parse({ value });
  },
});

export const deleteForUser = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const counters = await ctx.db
      .query("counters")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    for (const counter of counters) {
      await ctx.db.delete(counter._id);
    }

    return counters.length;
  },
});
