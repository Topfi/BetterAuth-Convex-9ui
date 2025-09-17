export type BetterAuthRateLimitConfig = {
  enabled: boolean;
  windowSeconds: number;
  maxRequests: number;
};

export type SensitiveRateLimitRule = {

  path: string;
  windowSeconds: number;
  maxRequests: number;
};

export type BetterAuthCustomRateLimitRules = Record<
  string,
  {
    window: number;
    max: number;
  }
>;

export const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;

export const RATE_LIMIT_ENV_FLAGS = {
  enabled: "BETTERAUTH_RATE_LIMIT_ENABLED",
  windowSeconds: "BETTERAUTH_RATE_LIMIT_WINDOW_SECONDS",
  maxRequests: "BETTERAUTH_RATE_LIMIT_MAX_REQUESTS",
} as const;

const parseBooleanFlag = (value: string | undefined): boolean | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return null;
};

const parsePositiveInteger = (value: string | undefined): number | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export const resolveBetterAuthRateLimitConfig = (
  env: Record<string, string | undefined>,
): BetterAuthRateLimitConfig => {
  const baseEnabled = env.NODE_ENV?.toLowerCase() === "production";
  const explicitEnabled = parseBooleanFlag(env[RATE_LIMIT_ENV_FLAGS.enabled]);

  const windowSeconds =
    parsePositiveInteger(env[RATE_LIMIT_ENV_FLAGS.windowSeconds]) ??
    DEFAULT_RATE_LIMIT_WINDOW_SECONDS;
  const maxRequests =
    parsePositiveInteger(env[RATE_LIMIT_ENV_FLAGS.maxRequests]) ??
    DEFAULT_RATE_LIMIT_MAX_REQUESTS;

  return {
    enabled: explicitEnabled ?? baseEnabled,
    windowSeconds,
    maxRequests,
  };
};

const SENSITIVE_ACTION_RULES: SensitiveRateLimitRule[] = [
  {
    path: "/sign-in/*",
    windowSeconds: 60,
    maxRequests: 5,
  },
  {
    path: "/sign-up/*",
    windowSeconds: 300,
    maxRequests: 5,
  },
  {
    path: "/magic-link/*",
    windowSeconds: 60,
    maxRequests: 5,
  },
  {
    path: "/email-otp/*",
    windowSeconds: 60,
    maxRequests: 5,
  },
  {
    path: "/phone-number/*",
    windowSeconds: 60,
    maxRequests: 5,
  },
  {
    path: "/change-password",
    windowSeconds: 600,
    maxRequests: 3,
  },
  {
    path: "/set-password",
    windowSeconds: 600,
    maxRequests: 3,
  },
  {
    path: "/reset-password",
    windowSeconds: 600,
    maxRequests: 3,
  },
  {
    path: "/change-email",
    windowSeconds: 900,
    maxRequests: 3,
  },
  {
    path: "/verify-email",
    windowSeconds: 120,
    maxRequests: 5,
  },
  {
    path: "/update-user",
    windowSeconds: 120,
    maxRequests: 6,
  },
  {
    path: "/delete-user",
    windowSeconds: 3600,
    maxRequests: 2,
  },
];

const toCustomRule = (
  rule: SensitiveRateLimitRule,
): BetterAuthCustomRateLimitRules[number] => {
  return {
    window: rule.windowSeconds,
    max: rule.maxRequests,
  };
};

export const resolveSensitiveActionRateLimits = (
  baseConfig: BetterAuthRateLimitConfig,
  overrides: SensitiveRateLimitRule[] = SENSITIVE_ACTION_RULES,
): BetterAuthCustomRateLimitRules => {
  return overrides.reduce<BetterAuthCustomRateLimitRules>((acc, rule) => {
    const windowSeconds = Number.isFinite(rule.windowSeconds)
      ? rule.windowSeconds
      : baseConfig.windowSeconds;
    const maxRequests = Number.isFinite(rule.maxRequests)
      ? rule.maxRequests
      : baseConfig.maxRequests;

    acc[rule.path] = toCustomRule({
      path: rule.path,
      windowSeconds:
        windowSeconds > 0 ? windowSeconds : baseConfig.windowSeconds,
      maxRequests: maxRequests > 0 ? maxRequests : baseConfig.maxRequests,
    });
    return acc;
  }, {});
};
