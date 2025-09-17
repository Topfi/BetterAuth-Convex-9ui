import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  requestPassphraseReset,
  signInWithPassphrase,
  signUpWithPassphrase,
} from "./passphrase";
import { authClient } from "@/lib/auth-client";

vi.mock("@/lib/auth-client", () => {
  return {
    authClient: {
      signIn: {
        email: vi.fn(),
        username: vi.fn(),
      },
      signUp: {
        email: vi.fn(),
      },
      forgetPassword: vi.fn(),
    },
  };
});

const strongSignInPassphrase = "maple-harbor-29-sky!";
const strongSignUpPassphrase = "nebula-river-77-light!";

describe("passphrase auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps passphrase to password during sign-in", async () => {
    const callbacks = {};
    const payload = {
      email: "USER@example.com",
      passphrase: strongSignInPassphrase,
    };

    await signInWithPassphrase(payload, callbacks);

    expect(authClient.signIn.email).toHaveBeenCalledWith(
      {
        email: "user@example.com",
        password: strongSignInPassphrase,
      },
      callbacks,
    );
  });

  it("maps passphrase to password during username sign-in", async () => {
    const callbacks = {};
    const payload = {
      username: "AdaLovelace",
      passphrase: strongSignInPassphrase,
    };

    await signInWithPassphrase(payload, callbacks);

    expect(authClient.signIn.username).toHaveBeenCalledWith(
      {
        username: "adalovelace",
        password: strongSignInPassphrase,
      },
      callbacks,
    );
  });

  it("maps passphrase to password during sign-up", async () => {
    const callbacks = {};
    const payload = {
      email: "NEW@example.com",
      passphrase: strongSignUpPassphrase,
      username: "newtest",
      displayUsername: "NewTest",
      name: "NewTest",
    };

    await signUpWithPassphrase(payload, callbacks);

    expect(authClient.signUp.email).toHaveBeenCalledWith(
      {
        email: "new@example.com",
        password: strongSignUpPassphrase,
        username: "newtest",
        displayUsername: "NewTest",
        name: "NewTest",
        callbackURL: expect.stringContaining("/auth/verification-success"),
      },
      callbacks,
    );
  });

  it("validates and forwards reset requests", async () => {
    await requestPassphraseReset({
      email: "USER@example.com",
      redirectTo: "https://example.com/reset",
    });

    expect(authClient.forgetPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      redirectTo: "https://example.com/reset",
    });
  });

  it("throws when provided invalid inputs", () => {
    expect(() =>
      signInWithPassphrase(
        {
          email: "invalid",
          passphrase: "123",
        },
        undefined,
      ),
    ).toThrowError();

    expect(() =>
      signInWithPassphrase(
        {
          username: "!notallowed",
          passphrase: strongSignInPassphrase,
        },
        undefined,
      ),
    ).toThrowError();

    expect(() =>
      signUpWithPassphrase(
        {
          email: "invalid",
          passphrase: "",
          name: "",
        },
        undefined,
      ),
    ).toThrowError();

    expect(() =>
      requestPassphraseReset({
        email: "invalid",
        redirectTo: "notaurl",
      }),
    ).toThrowError();
  });
});
