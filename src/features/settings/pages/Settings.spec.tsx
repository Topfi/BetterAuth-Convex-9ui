import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Settings from "./Settings";
import type { AuthenticatedOutletContext } from "@/features/app";
import { createUser } from "@/test/factories";
import {
  passphraseCompromisedErrorCode,
  passphraseCompromisedMessage,
} from "@shared/auth/haveIBeenPwned";

const authClientMocks = vi.hoisted(() => ({
  updateUser: vi.fn().mockResolvedValue(undefined),
  changeEmail: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  changePassword: vi.fn().mockResolvedValue(undefined),
  deleteUser: vi.fn().mockResolvedValue(undefined),
  $fetch: vi.fn().mockResolvedValue([] as Array<{ providerId: string }>),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

const generatePassphraseMock = vi.hoisted(() =>
  vi.fn(() => "winter-sky-aurora"),
);
const copyToClipboardMock = vi.hoisted(() => vi.fn(async () => true));
const validatePassphraseMock = vi.hoisted(() =>
  vi.fn(() => ({
    result: {
      score: 3,
      crackTimesSeconds: {},
      crackTimesDisplay: {},
      feedback: { warning: "", suggestions: [] },
      guesses: 0,
      guessesLog10: 0,
      sequence: [],
      calcTime: 0,
      password: "",
    },
    failures: [],
    isValid: true,
  })),
);
vi.mock("@/lib/auth-client", () => ({
  authClient: authClientMocks,
}));

vi.mock("@/lib/toast", () => ({
  toast: toastMocks,
}));

vi.mock("@/features/auth/api/passphraseGenerator", () => ({
  generatePassphrase: generatePassphraseMock,
}));

vi.mock("@/lib/clipboard", () => ({
  copyToClipboard: copyToClipboardMock,
}));

vi.mock("@/features/auth/api/passphraseStrength", () => ({
  validatePassphrase: validatePassphraseMock,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogHeader: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogDescription: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogFooter: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogClose: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authClientMocks.$fetch.mockResolvedValue([]);
  });

  it("updates profile details", async () => {
    const user = createUser({
      name: "Ada Lovelace",
      displayUsername: "adalovelace",
      email: "ada@example.com",
      emailVerified: true,
    });
    authClientMocks.$fetch.mockResolvedValueOnce([
      { providerId: "email-password" },
    ]);

    renderWithContext(user);

    const usernameInput = await screen.findByDisplayValue("adalovelace");
    await userEvent.clear(usernameInput);
    await userEvent.type(usernameInput, "AdaByron");

    await userEvent.click(
      screen.getByRole("button", { name: /save changes/i }),
    );

    await waitFor(() => {
      expect(authClientMocks.updateUser).toHaveBeenCalledWith({
        displayUsername: "AdaByron",
        username: "adabyron",
        name: "AdaByron",
      });
    });
    expect(toastMocks.success).toHaveBeenCalled();
  });

  it("changes email and signs out", async () => {
    const user = createUser({
      name: "Ada Lovelace",
      displayUsername: "adalovelace",
      email: "ada@example.com",
      emailVerified: true,
    });
    authClientMocks.$fetch.mockResolvedValueOnce([
      { providerId: "email-password" },
    ]);

    renderWithContext(user);

    const emailInput = await screen.findByDisplayValue("ada@example.com");
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "ada@newdomain.dev");

    await userEvent.click(
      screen.getByRole("button", { name: /update email/i }),
    );

    await waitFor(() => {
      expect(authClientMocks.changeEmail).toHaveBeenCalledWith({
        newEmail: "ada@newdomain.dev",
        callbackURL: expect.stringContaining("/settings"),
      });
    });
    expect(authClientMocks.signOut).toHaveBeenCalled();
    expect(toastMocks.warning).toHaveBeenCalled();
  });

  it("disables passphrase update when no passphrase is linked", async () => {
    const user = createUser({
      name: "Ada Lovelace",
      displayUsername: "adalovelace",
      email: "ada@example.com",
    });
    authClientMocks.$fetch.mockResolvedValueOnce([{ providerId: "github" }]);

    renderWithContext(user);

    await userEvent.click(screen.getByRole("tab", { name: /security/i }));
    const updateButton = await screen.findByRole("button", {
      name: /update passphrase/i,
    });
    expect(updateButton).toBeDisabled();
  });

  it("generates a strong passphrase, copies it, and shows a success toast", async () => {
    const user = createUser({
      name: "Ada Lovelace",
      displayUsername: "adalovelace",
      email: "ada@example.com",
    });
    authClientMocks.$fetch.mockResolvedValueOnce([
      { providerId: "email-password" },
    ]);

    renderWithContext(user);

    await userEvent.click(screen.getByRole("tab", { name: /security/i }));
    const generateButton = await screen.findByRole("button", {
      name: /generate strong passphrase/i,
    });
    await userEvent.click(generateButton);

    await waitFor(() => {
      expect(generatePassphraseMock).toHaveBeenCalled();
    });

    const generatedInputs = screen.getAllByDisplayValue("winter-sky-aurora");
    expect(generatedInputs).toHaveLength(2);
    expect(copyToClipboardMock).toHaveBeenCalledWith("winter-sky-aurora");
    expect(toastMocks.success).toHaveBeenCalledWith({
      title: "Passphrase generated",
      description: "We filled both fields and copied it to your clipboard.",
    });
    expect(screen.getByText("Strength")).toBeInTheDocument();
  });

  it("warns when clipboard access is unavailable while generating", async () => {
    const user = createUser({
      name: "Ada Lovelace",
      displayUsername: "adalovelace",
      email: "ada@example.com",
    });
    authClientMocks.$fetch.mockResolvedValueOnce([
      { providerId: "email-password" },
    ]);
    copyToClipboardMock.mockResolvedValueOnce(false);

    renderWithContext(user);

    await userEvent.click(screen.getByRole("tab", { name: /security/i }));
    const generateButton = await screen.findByRole("button", {
      name: /generate strong passphrase/i,
    });
    await userEvent.click(generateButton);

    await waitFor(() => {
      expect(generatePassphraseMock).toHaveBeenCalled();
    });

    expect(toastMocks.warning).toHaveBeenCalledWith({
      title: "Clipboard unavailable",
      description:
        "We filled both fields but couldn't copy. Copy it manually to keep access.",
    });
  });

  it("surfaces passphrase breach errors returned by Better Auth", async () => {
    const user = createUser({
      name: "Ada Lovelace",
      displayUsername: "adalovelace",
      email: "ada@example.com",
    });
    authClientMocks.$fetch.mockResolvedValueOnce([
      { providerId: "email-password" },
    ]);
    const compromisedError = Object.assign(new Error("Bad Request"), {
      data: {
        code: passphraseCompromisedErrorCode,
        message: passphraseCompromisedMessage,
      },
    });
    authClientMocks.changePassword.mockRejectedValueOnce(compromisedError);

    renderWithContext(user);

    await userEvent.click(screen.getByRole("tab", { name: /security/i }));

    await screen.findByText("Current passphrase");
    const currentInput = getPassphraseInput("currentPassphrase");
    const newInput = getPassphraseInput("nextPassphrase");
    const confirmInput = getPassphraseInput("confirmPassphrase");

    await userEvent.type(currentInput, "current-passphrase-strong-1234");
    await userEvent.type(newInput, "next-passphrase-strong-5678");
    await userEvent.type(confirmInput, "next-passphrase-strong-5678");

    await userEvent.click(
      screen.getByRole("button", { name: /update passphrase/i }),
    );

    await waitFor(() => {
      expect(authClientMocks.changePassword).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith({
        title: "Passphrase rejected",
        description: passphraseCompromisedMessage,
      });
    });

    expect(
      await screen.findByText(passphraseCompromisedMessage),
    ).toBeInTheDocument();
  });

  it("deletes the account after confirmation", async () => {
    const user = createUser({
      name: "Ada Lovelace",
      displayUsername: "adalovelace",
      email: "ada@example.com",
    });
    authClientMocks.$fetch.mockResolvedValueOnce([
      { providerId: "email-password" },
    ]);

    renderWithContext(user);

    await userEvent.click(screen.getByRole("tab", { name: /privacy/i }));
    const deleteButtons = await screen.findAllByRole("button", {
      name: /delete account/i,
    });
    await userEvent.click(deleteButtons[0]);
    const textInputs = screen.getAllByRole("textbox");
    const dialogInput = textInputs[textInputs.length - 1];
    await userEvent.type(dialogInput, "Ada Lovelace");

    await userEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => {
      expect(authClientMocks.deleteUser).toHaveBeenCalled();
    });
    expect(toastMocks.success).toHaveBeenCalled();
  });
});

function getPassphraseInput(name: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(
    `input[name="${name}"]`,
  );

  if (!input) {
    throw new Error(`Unable to locate passphrase input: ${name}`);
  }

  return input;
}

function renderWithContext(user: ReturnType<typeof createUser>) {
  const context = {
    user: {
      ...user,
      emailVerified: user.emailVerified ?? false,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
    },
    displayName:
      user.displayUsername ?? user.username ?? user.name ?? "Account",
    avatarInitial: (
      user.displayUsername ??
      user.username ??
      user.name ??
      "Account"
    )
      .slice(0, 1)
      .toUpperCase(),
  } satisfies AuthenticatedOutletContext;

  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <Routes>
        <Route element={<ContextLayout context={context} />}>
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function ContextLayout({ context }: { context: AuthenticatedOutletContext }) {
  return <Outlet context={context} />;
}
