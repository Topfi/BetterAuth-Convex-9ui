import { z } from "zod";

const SIGN_IN_OPTION_DEFAULTS = {
  passphrase: true,
  otp: true,
  magicLink: true,
  google: true,
  github: true,
  apple: true,
} as const;

export type SignInOptionName = keyof typeof SIGN_IN_OPTION_DEFAULTS;

export type SignInOptions = Readonly<{
  [Key in SignInOptionName]: boolean;
}>;

const SIGN_IN_OPTION_ENV_KEYS = {
  passphrase: "VITE_SIGNIN_ENABLE_PASSPHRASE",
  otp: "VITE_SIGNIN_ENABLE_OTP",
  magicLink: "VITE_SIGNIN_ENABLE_MAGIC_LINK",
  google: "VITE_SIGNIN_ENABLE_GOOGLE",
  github: "VITE_SIGNIN_ENABLE_GITHUB",
  apple: "VITE_SIGNIN_ENABLE_APPLE",
} satisfies Record<SignInOptionName, string>;

const booleanFlagSchema = z
  .union([
    z.boolean(),
    z
      .string()
      .trim()
      .transform((value) => value.toLowerCase()),
  ])
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    if (value.length === 0) {
      return null;
    }

    if (["1", "true", "yes", "on"].includes(value)) {
      return true;
    }

    if (["0", "false", "no", "off"].includes(value)) {
      return false;
    }

    throw new Error(
      `Invalid boolean value "${value}". Use one of: true, false, 1, 0, yes, no, on, off.`,
    );
  });

const coerceBooleanFlag = (
  rawValue: string | boolean | undefined,
  defaultValue: boolean,
): boolean => {
  if (rawValue === undefined) {
    return defaultValue;
  }

  const result = booleanFlagSchema.safeParse(rawValue);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid boolean value");
  }

  return result.data ?? defaultValue;
};

export const resolveSignInOptions = (
  env: Record<string, string | boolean | undefined>,
): SignInOptions => {
  const entries = Object.entries(SIGN_IN_OPTION_ENV_KEYS).map(
    ([optionName, envKey]) => {
      const defaultValue =
        SIGN_IN_OPTION_DEFAULTS[optionName as SignInOptionName];
      const rawValue = env[envKey];
      const value = coerceBooleanFlag(rawValue, defaultValue);
      return [optionName, value] as const;
    },
  );

  return Object.fromEntries(entries) as SignInOptions;
};

export const hasPassphraselessMethod = (options: SignInOptions): boolean =>
  options.magicLink || options.otp;

export const hasAnySignInMethod = (options: SignInOptions): boolean =>
  options.passphrase || hasPassphraselessMethod(options);
