import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  appUsers: defineTable({
    authUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    displayUsername: v.optional(v.string()),
    username: v.optional(v.string()),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("authUserId", ["authUserId"]),
  counters: defineTable({
    userId: v.string(),
    value: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("userId", ["userId"]),
  auditLogs: defineTable({
    event: v.string(),
    userId: v.string(),
    actorId: v.string(),
    createdAt: v.number(),
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
  })
    .index("userIdCreatedAt", ["userId", "createdAt"])
    .index("eventCreatedAt", ["event", "createdAt"]),
});

export default schema;
