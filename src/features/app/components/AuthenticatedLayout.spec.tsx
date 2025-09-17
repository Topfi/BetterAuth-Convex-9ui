import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUser } from "@/test/factories";
import { AuthenticatedLayout } from "./AuthenticatedLayout";

const useQueryMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: (...args: unknown[]) => signOutMock(...args),
  },
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));

describe("AuthenticatedLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a loading state until the user is available", () => {
    useQueryMock.mockReturnValueOnce(undefined);

    renderAuthenticatedLayout();

    expect(screen.getByText(/loading your space/i)).toBeInTheDocument();
  });

  it("renders user information and supports signing out", async () => {
    const user = createUser({
      name: "  Ada Lovelace  ",
      email: "ada@example.com",
    });
    useQueryMock.mockReturnValueOnce(user);

    renderAuthenticatedLayout();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /settings/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it("shows a back button while viewing settings", () => {
    useQueryMock.mockReturnValueOnce(
      createUser({ name: "Ada Lovelace", email: "ada@example.com" }),
    );

    renderAuthenticatedLayout(["/settings"]);

    expect(
      screen.getByRole("button", { name: /back to app/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /settings/i }),
    ).not.toBeInTheDocument();
  });
});

function renderAuthenticatedLayout(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<AuthenticatedLayout />}>
          <Route index element={<div>Dashboard</div>} />
          <Route path="settings" element={<div>Settings</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
