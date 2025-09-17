import { describe, expect, it, vi } from "vitest";

import { toast } from "./toast";

const { addMock } = vi.hoisted(() => ({
  addMock: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toastManager: {
    add: addMock,
  },
}));

describe("toast helper", () => {
  it("forwards toast calls with severity metadata", () => {
    toast.success({ title: "All good" });
    toast.error({ title: "Uh oh", description: "Try again" });

    expect(addMock).toHaveBeenNthCalledWith(1, {
      title: "All good",
      type: "success",
    });
    expect(addMock).toHaveBeenNthCalledWith(2, {
      title: "Uh oh",
      description: "Try again",
      type: "error",
    });
  });
});
