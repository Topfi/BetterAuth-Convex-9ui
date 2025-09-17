import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Counter } from "./Counter";

type MutationStub = ((...args: unknown[]) => Promise<unknown>) & {
  withOptimisticUpdate: (updater: unknown) => unknown;
};

const createMutationStub = vi.hoisted<() => MutationStub>(() => {
  return () => {
    const fn = vi.fn(() => Promise.resolve(undefined)) as MutationStub;
    fn.withOptimisticUpdate = vi.fn(() => fn);
    return fn;
  };
});

const useQueryMock = vi.hoisted(() => vi.fn());
const useMutationMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (...args: unknown[]) => useMutationMock(...args),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: toastErrorMock,
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("Counter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a loading placeholder when the counter is loading", () => {
    useQueryMock.mockReturnValueOnce(undefined);
    useMutationMock.mockReturnValue(createMutationStub());

    render(<Counter />);

    expect(screen.getByText("--")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /increase/i })).toBeDisabled();
  });

  it("disables decrement and reset when the counter is zero", () => {
    useQueryMock.mockReturnValueOnce({ value: 0 });
    useMutationMock.mockReturnValue(createMutationStub());

    render(<Counter />);

    expect(screen.getByRole("button", { name: /decrease/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /reset counter/i }),
    ).toBeDisabled();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("invokes optimistic increment handlers when clicking increase", async () => {
    const user = userEvent.setup();
    const incrementStub = createMutationStub();
    const decrementStub = createMutationStub();
    const resetStub = createMutationStub();

    useQueryMock.mockReturnValueOnce({ value: 3 });
    useMutationMock
      .mockReturnValueOnce(incrementStub)
      .mockReturnValueOnce(decrementStub)
      .mockReturnValueOnce(resetStub);

    render(<Counter />);

    await user.click(screen.getByRole("button", { name: /increase/i }));

    expect(incrementStub.withOptimisticUpdate).toHaveBeenCalledTimes(1);
    expect(incrementStub).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when a mutation fails", async () => {
    const user = userEvent.setup();
    const failingIncrement = createMutationStub();
    failingIncrement.mockImplementationOnce(() =>
      Promise.reject(new Error("Network down")),
    );

    useQueryMock.mockReturnValueOnce({ value: 2 });
    useMutationMock
      .mockReturnValueOnce(failingIncrement)
      .mockReturnValue(createMutationStub());

    render(<Counter />);

    await user.click(screen.getByRole("button", { name: /increase/i }));

    expect(toastErrorMock).toHaveBeenCalledWith({
      title: "Failed to update counter",
      description: "Network down",
    });
  });
});
