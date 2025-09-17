import { describe, expect, it } from "vitest";

import { applyCounterDelta, defaultCounterValue } from "./counter";

describe("applyCounterDelta", () => {
  it("increments from the default value when no current state is provided", () => {
    const result = applyCounterDelta(undefined, 1);
    expect(result.value).toBe(defaultCounterValue.value + 1);
  });

  it("never returns a negative counter", () => {
    const result = applyCounterDelta({ value: 1 }, -5);
    expect(result.value).toBe(0);
  });
});
