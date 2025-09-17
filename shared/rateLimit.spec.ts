import { describe, expect, it } from "vitest";

import {
  resolveBetterAuthRateLimitConfig,
  resolveSensitiveActionRateLimits,
  type BetterAuthRateLimitConfig,
  RATE_LIMIT_ENV_FLAGS,
} from "./rateLimit";

const baseEnv: Record<string, string | undefined> = {};

const defaults: BetterAuthRateLimitConfig = {
  enabled: false,
  windowSeconds: 60,
  maxRequests: 100,
};

describe("resolveBetterAuthRateLimitConfig", () => {
  it("uses production defaults when no overrides are provided", () => {
    const config = resolveBetterAuthRateLimitConfig({
      ...baseEnv,
      NODE_ENV: "production",
    });

    expect(config).toEqual({
      ...defaults,
      enabled: true,
    });
  });

  it("disables rate limiting outside production when not explicitly enabled", () => {
    const config = resolveBetterAuthRateLimitConfig({
      ...baseEnv,
      NODE_ENV: "development",
    });

    expect(config).toEqual(defaults);
  });

  it("respects explicit enablement flag regardless of NODE_ENV", () => {
    const config = resolveBetterAuthRateLimitConfig({
      ...baseEnv,
      [RATE_LIMIT_ENV_FLAGS.enabled]: "1",
      NODE_ENV: "development",
    });

    expect(config.enabled).toBe(true);
  });

  it("respects explicit disablement flag regardless of NODE_ENV", () => {
    const config = resolveBetterAuthRateLimitConfig({
      ...baseEnv,
      [RATE_LIMIT_ENV_FLAGS.enabled]: "false",
      NODE_ENV: "production",
    });

    expect(config.enabled).toBe(false);
  });

  it("parses custom window and max values when provided", () => {
    const config = resolveBetterAuthRateLimitConfig({
      ...baseEnv,
      NODE_ENV: "production",
      [RATE_LIMIT_ENV_FLAGS.windowSeconds]: "45",
      [RATE_LIMIT_ENV_FLAGS.maxRequests]: "120",
    });

    expect(config.windowSeconds).toBe(45);
    expect(config.maxRequests).toBe(120);
  });

  it("falls back to defaults when custom values are invalid", () => {
    const config = resolveBetterAuthRateLimitConfig({
      ...baseEnv,
      NODE_ENV: "production",
      [RATE_LIMIT_ENV_FLAGS.windowSeconds]: "-1",
      [RATE_LIMIT_ENV_FLAGS.maxRequests]: "not-a-number",
    });

    expect(config.windowSeconds).toBe(defaults.windowSeconds);
    expect(config.maxRequests).toBe(defaults.maxRequests);
  });
});

describe("resolveSensitiveActionRateLimits", () => {
  const baseConfig: BetterAuthRateLimitConfig = {
    enabled: true,
    windowSeconds: 90,
    maxRequests: 42,
  };

  it("produces a mapping for the default sensitive actions", () => {
    const rules = resolveSensitiveActionRateLimits(baseConfig);

    expect(rules).toMatchObject({
      "/sign-in/*": { window: 60, max: 5 },
      "/sign-up/*": { window: 300, max: 5 },
      "/update-user": { window: 120, max: 6 },
      "/delete-user": { window: 3600, max: 2 },
    });
  });

  it("falls back to the base config when overrides are invalid", () => {
    const rules = resolveSensitiveActionRateLimits(baseConfig, [
      {
        path: "/custom",
        windowSeconds: Number.NaN,
        maxRequests: Number.NaN,
      },
    ]);

    expect(rules["/custom"]).toEqual({
      window: baseConfig.windowSeconds,
      max: baseConfig.maxRequests,
    });
  });
});
