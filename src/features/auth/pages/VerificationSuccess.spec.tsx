import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => hoisted.navigateMock,
  };
});

import { AUTH_SIGN_IN_PATH } from "@shared/routes";
import VerificationSuccess from "./VerificationSuccess";

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <VerificationSuccess />
    </MemoryRouter>,
  );
};

describe("VerificationSuccess", () => {
  beforeEach(() => {
    hoisted.navigateMock.mockClear();
  });

  it("renders verification confirmation with manual navigation", () => {
    renderComponent();

    expect(screen.getByText(/email verified/i)).toBeInTheDocument();
    expect(
      screen.getByText(/redirecting you to the sign in page/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /go to sign in/i }),
    ).toBeInTheDocument();
  });

  it("redirects automatically after five seconds", async () => {
    vi.useFakeTimers();
    try {
      renderComponent();

      await vi.advanceTimersByTimeAsync(5000);

      expect(hoisted.navigateMock).toHaveBeenCalledWith(AUTH_SIGN_IN_PATH, {
        replace: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("navigates immediately when the sign in button is clicked", async () => {
    renderComponent();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /go to sign in/i }));

    expect(hoisted.navigateMock).toHaveBeenCalledWith(AUTH_SIGN_IN_PATH, {
      replace: true,
    });
  });
});
