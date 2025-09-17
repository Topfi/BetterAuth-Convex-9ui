import { describe, expect, it, vi } from "vitest";

import { createUserDataDeletionRegistry } from "./userData";

describe("createUserDataDeletionRegistry", () => {
  it("prevents duplicate domain registration", () => {
    const registry = createUserDataDeletionRegistry<unknown>();
    registry.register("example", async () => undefined);

    expect(() =>
      registry.register("example", async () => undefined),
    ).toThrowError('User data purger already registered for domain "example"');
  });

  it("runs registered purgers in order and aggregates results", async () => {
    const registry = createUserDataDeletionRegistry<{ label: string }>();
    const ctx = { label: "ctx" };

    const first = vi.fn().mockResolvedValue({ deletedRecords: 2 });
    const second = vi.fn().mockResolvedValue(undefined);

    registry.register("first", first);
    registry.register("second", second);

    const results = await registry.run(ctx, "user-123");

    expect(first).toHaveBeenCalledWith(ctx, "user-123");
    expect(second).toHaveBeenCalledWith(ctx, "user-123");
    expect(results).toEqual([
      { domain: "first", deletedRecords: 2 },
      { domain: "second" },
    ]);
  });

  it("exposes registered domain names", () => {
    const registry = createUserDataDeletionRegistry<unknown>();
    registry.register("alpha", async () => undefined);
    registry.register("beta", async () => undefined);

    expect(registry.getDomains()).toEqual(["alpha", "beta"]);
  });
});
