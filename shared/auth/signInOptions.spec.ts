import { describe, expect, test } from "vitest";

import {
  hasAnySignInMethod,
  hasPassphraselessMethod,
  resolveSignInOptions,
} from "./signInOptions";

describe("resolveSignInOptions", () => {
  test("uses defaults when env is empty", () => {
    const result = resolveSignInOptions({});

    expect(result).toEqual({
      passphrase: true,
      otp: true,
      magicLink: true,
      google: true,
      github: true,
      apple: true,
    });
  });

  test("parses boolean-like strings", () => {
    const result = resolveSignInOptions({
      VITE_SIGNIN_ENABLE_PASSPHRASE: "false",
      VITE_SIGNIN_ENABLE_OTP: "0",
      VITE_SIGNIN_ENABLE_MAGIC_LINK: "yes",
      VITE_SIGNIN_ENABLE_GOOGLE: "ON",
      VITE_SIGNIN_ENABLE_GITHUB: "no",
      VITE_SIGNIN_ENABLE_APPLE: "off",
    });

    expect(result).toEqual({
      passphrase: false,
      otp: false,
      magicLink: true,
      google: true,
      github: false,
      apple: false,
    });
  });

  test("throws on invalid boolean values", () => {
    expect(() =>
      resolveSignInOptions({
        VITE_SIGNIN_ENABLE_PASSPHRASE: "maybe",
      }),
    ).toThrowError(/Invalid boolean value/);
  });
});

describe("hasPassphraselessMethod", () => {
  test("returns true when at least one passphraseless option is enabled", () => {
    const options = resolveSignInOptions({
      VITE_SIGNIN_ENABLE_PASSPHRASE: "false",
      VITE_SIGNIN_ENABLE_MAGIC_LINK: "true",
      VITE_SIGNIN_ENABLE_OTP: "false",
    });

    expect(hasPassphraselessMethod(options)).toBe(true);
  });
});

describe("hasAnySignInMethod", () => {
  test("returns false when all methods are disabled", () => {
    const options = resolveSignInOptions({
      VITE_SIGNIN_ENABLE_PASSPHRASE: "false",
      VITE_SIGNIN_ENABLE_MAGIC_LINK: "false",
      VITE_SIGNIN_ENABLE_OTP: "false",
    });

    expect(hasAnySignInMethod(options)).toBe(false);
  });
});
