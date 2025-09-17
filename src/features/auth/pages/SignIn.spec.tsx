import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import SignIn from "./SignIn";
import type {
  RequestPassphraseResetInput,
  SignInWithPassphraseInput,
} from "@shared/auth";
import {
  formatCombinedHistoricalPlaceholder,
  historicalIdentifierPlaceholders,
} from "@shared/auth/historicalIdentifierPlaceholders";

type AuthCallbacks = {
  onRequest?: () => void;
  onSuccess?: () => void;
  onError?: (ctx: { error: Error }) => void;
};

const mocks = vi.hoisted(() => {
  const signInWithPassphraseMock = vi.fn(
    async (_config: SignInWithPassphraseInput, callbacks?: AuthCallbacks) => {
      callbacks?.onRequest?.();
      callbacks?.onSuccess?.();
    },
  );

  const requestPassphraseResetMock = vi.fn(
    async (_input: RequestPassphraseResetInput) => {
      return Promise.resolve();
    },
  );

  const magicLinkMock = vi.fn(async (_config, callbacks?: AuthCallbacks) => {
    callbacks?.onRequest?.();
    callbacks?.onSuccess?.();
  });

  const emailOtpSendMock = vi.fn(async (_config, callbacks?: AuthCallbacks) => {
    callbacks?.onRequest?.();
    callbacks?.onSuccess?.();
  });

  const emailOtpVerifyMock = vi.fn(
    async (_config, callbacks?: AuthCallbacks) => {
      callbacks?.onRequest?.();
      callbacks?.onSuccess?.();
    },
  );

  const socialMock = vi.fn(async (_config, callbacks?: AuthCallbacks) => {
    callbacks?.onRequest?.();
    callbacks?.onSuccess?.();
  });

  return {
    signInWithPassphraseMock,
    requestPassphraseResetMock,
    magicLinkMock,
    emailOtpSendMock,
    emailOtpVerifyMock,
    socialMock,
    toastSuccessMock: vi.fn(),
    toastInfoMock: vi.fn(),
    toastErrorMock: vi.fn(),
  };
});

vi.mock("@/features/auth/api/passphrase", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/auth/api/passphrase")>();
  return {
    ...actual,
    signInWithPassphrase: mocks.signInWithPassphraseMock,
    requestPassphraseReset: mocks.requestPassphraseResetMock,
  };
});

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      magicLink: mocks.magicLinkMock,
      emailOtp: mocks.emailOtpVerifyMock,
      social: mocks.socialMock,
    },
    emailOtp: {
      sendVerificationOtp: mocks.emailOtpSendMock,
    },
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccessMock(...args),
    info: (...args: unknown[]) => mocks.toastInfoMock(...args),
    error: (...args: unknown[]) => mocks.toastErrorMock(...args),
    warning: vi.fn(),
  },
}));

const {
  signInWithPassphraseMock,
  requestPassphraseResetMock,
  magicLinkMock,
  emailOtpSendMock,
  emailOtpVerifyMock,
  socialMock,
  toastSuccessMock,
  toastInfoMock,
  toastErrorMock,
} = mocks;

const combinedIdentifierPlaceholders = historicalIdentifierPlaceholders.map(
  (entry) => formatCombinedHistoricalPlaceholder(entry),
);
const emailOnlyPlaceholders = historicalIdentifierPlaceholders.map(
  (entry) => entry.email,
);

const findInputByPlaceholder = (placeholders: readonly string[]) => {
  for (const placeholder of placeholders) {
    const element = screen.queryByPlaceholderText(placeholder);
    if (element instanceof HTMLInputElement) {
      return element;
    }
  }
  return null;
};

const getIdentifierInput = () => {
  const historicalInput = findInputByPlaceholder(
    combinedIdentifierPlaceholders,
  );
  if (historicalInput) {
    return historicalInput;
  }

  const historicalEmailInput = findInputByPlaceholder(emailOnlyPlaceholders);
  if (historicalEmailInput) {
    return historicalEmailInput;
  }

  throw new Error("Identifier input not found");
};

const fillIdentifier = async (value: string) => {
  const user = userEvent.setup();
  await user.type(getIdentifierInput(), value);
};

describe("SignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses a historical email placeholder when passphraseless sign-in is active", () => {
    const mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    try {
      render(
        <MemoryRouter>
          <SignIn />
        </MemoryRouter>,
      );

      expect(
        screen.getByPlaceholderText(historicalIdentifierPlaceholders[0].email),
      ).toBeInTheDocument();
    } finally {
      mathRandomSpy.mockRestore();
    }
  });

  it("uses a historical identifier placeholder when passphrase sign-in is selected", async () => {
    const mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const user = userEvent.setup();

    try {
      render(
        <MemoryRouter>
          <SignIn />
        </MemoryRouter>,
      );

      await user.click(
        screen.getByRole("button", {
          name: /sign in with a passphrase instead/i,
        }),
      );

      const expectedPlaceholder = formatCombinedHistoricalPlaceholder(
        historicalIdentifierPlaceholders[0],
      );

      expect(
        screen.getByPlaceholderText(expectedPlaceholder),
      ).toBeInTheDocument();
    } finally {
      mathRandomSpy.mockRestore();
    }
  });

  it("signs in with a passphrase when submitted", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://app.example.com");
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", {
        name: /sign in with a passphrase instead/i,
      }),
    );

    await fillIdentifier("USER@example.com");
    await user.type(
      screen.getByPlaceholderText("Enter your passphrase"),
      "correct horse battery",
    );

    await user.click(
      screen.getByRole("button", { name: /sign in with passphrase/i }),
    );

    expect(signInWithPassphraseMock).toHaveBeenCalledWith(
      {
        email: "user@example.com",
        passphrase: "correct horse battery",
      },
      expect.any(Object),
    );
    expect(toastSuccessMock).toHaveBeenCalledWith({
      title: "Signed in",
      description: "You have successfully signed in with your passphrase.",
    });
  });

  it("signs in with a username when provided", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://app.example.com");
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", {
        name: /sign in with a passphrase instead/i,
      }),
    );

    await fillIdentifier("AdaLovelace");
    await user.type(
      screen.getByPlaceholderText("Enter your passphrase"),
      "correct horse battery",
    );

    await user.click(
      screen.getByRole("button", { name: /sign in with passphrase/i }),
    );

    expect(signInWithPassphraseMock).toHaveBeenCalledWith(
      {
        username: "adalovelace",
        passphrase: "correct horse battery",
      },
      expect.any(Object),
    );
    expect(toastSuccessMock).toHaveBeenCalledWith({
      title: "Signed in",
      description: "You have successfully signed in with your passphrase.",
    });
  });

  it("sends a verification code and renders the OTP input", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://app.example.com");
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>,
    );

    await fillIdentifier("otp@example.com");

    await user.click(
      screen.getByRole("button", { name: /send verification code/i }),
    );

    expect(emailOtpSendMock).toHaveBeenCalledWith(
      {
        email: "otp@example.com",
        type: "sign-in",
      },
      expect.any(Object),
    );
    expect(toastInfoMock).toHaveBeenCalledWith({
      title: "Verification code sent",
      description: "Enter the code from your email to finish signing in.",
    });
    expect(
      await screen.findByPlaceholderText("Enter verification code"),
    ).toBeInTheDocument();
  });

  it("verifies an OTP after it has been sent", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://app.example.com");
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>,
    );

    await fillIdentifier("verify@example.com");

    await user.click(
      screen.getByRole("button", { name: /send verification code/i }),
    );

    await user.type(
      screen.getByPlaceholderText("Enter verification code"),
      "123456",
    );

    await user.click(screen.getByRole("button", { name: /verify code/i }));

    expect(emailOtpVerifyMock).toHaveBeenCalledWith(
      {
        email: "verify@example.com",
        otp: "123456",
      },
      expect.any(Object),
    );
    expect(toastSuccessMock).toHaveBeenCalledWith({
      title: "Signed in",
      description: "Your verification code was accepted.",
    });
  });

  it("requests a passphrase reset when configuration is available", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://app.example.com");
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", {
        name: /sign in with a passphrase instead/i,
      }),
    );

    await fillIdentifier("reset@example.com");

    await user.click(
      screen.getByRole("button", { name: /forgot your passphrase/i }),
    );

    expect(requestPassphraseResetMock).toHaveBeenCalledWith({
      email: "reset@example.com",
      redirectTo: "https://app.example.com/reset-passphrase",
    });
    expect(toastSuccessMock).toHaveBeenCalledWith({
      title: "Reset link sent",
      description: "Check your email to finish resetting your passphrase.",
    });
  });

  it("obscures whether a passphrase reset lookup found a user", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://app.example.com");
    requestPassphraseResetMock.mockRejectedValueOnce(
      new Error("Reset Password: User not found"),
    );
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", {
        name: /sign in with a passphrase instead/i,
      }),
    );

    await fillIdentifier("reset@example.com");

    await user.click(
      screen.getByRole("button", { name: /forgot your passphrase/i }),
    );

    await waitFor(() => {
      expect(requestPassphraseResetMock).toHaveBeenCalledWith({
        email: "reset@example.com",
        redirectTo: "https://app.example.com/reset-passphrase",
      });
      expect(toastErrorMock).toHaveBeenCalledWith({
        title: "Unable to send reset link",
        description:
          "If we have an account matching that email, we'll send passphrase reset instructions.",
      });
    });
  });

  it("shows an error if passphrase reset configuration is missing", async () => {
    vi.stubEnv("VITE_SITE_URL", "");
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", {
        name: /sign in with a passphrase instead/i,
      }),
    );

    await fillIdentifier("reset@example.com");

    await user.click(
      screen.getByRole("button", { name: /forgot your passphrase/i }),
    );

    expect(requestPassphraseResetMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith({
      title: "Reset unavailable",
      description:
        "Missing VITE_SITE_URL. Update your environment configuration.",
    });
  });

  it("sends a magic link", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://app.example.com");
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>,
    );

    await fillIdentifier("magic@example.com");

    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    expect(magicLinkMock).toHaveBeenCalledWith(
      { email: "magic@example.com" },
      expect.any(Object),
    );
    expect(toastInfoMock).toHaveBeenCalledWith({
      title: "Magic link sent",
      description: "Check your email to finish signing in.",
    });
  });

  it("delegates to social sign-in providers", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /sign in with github/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /sign in with google/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /sign in with apple/i }),
    );

    expect(socialMock).toHaveBeenNthCalledWith(
      1,
      { provider: "github" },
      expect.any(Object),
    );
    expect(socialMock).toHaveBeenNthCalledWith(
      2,
      { provider: "google" },
      expect.any(Object),
    );
    expect(socialMock).toHaveBeenNthCalledWith(
      3,
      { provider: "apple" },
      expect.any(Object),
    );
  });
});
