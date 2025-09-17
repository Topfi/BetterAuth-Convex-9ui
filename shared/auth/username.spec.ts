import { describe, expect, it } from "vitest";

import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  deriveUsernamePair,
  deriveUsernamePairFromEmail,
  deriveUsernamePairWithSuffix,
  deriveUsernameSeed,
  normalizedUsernameSchema,
  sanitizeUsernameCandidate,
  usernameInputSchema,
  withNumericSuffix,
} from "./username";

describe("username helpers", () => {
  it("normalizes while preserving display casing", () => {
    const result = deriveUsernamePair("Bob");
    expect(result).toEqual({ username: "bob", displayUsername: "Bob" });
  });

  it("rejects unsupported characters", () => {
    expect(() => usernameInputSchema.parse("has spaces")).toThrowError(
      /Usernames can only include letters, numbers, underscores, and dots\./,
    );
  });

  it("requires normalized usernames to be lowercase", () => {
    expect(() => normalizedUsernameSchema.parse("MixedCase")).toThrowError(
      /Normalized usernames must be lowercase\./,
    );

    expect(normalizedUsernameSchema.parse("lowercase")).toBe("lowercase");
  });

  it("sanitizes invalid email local parts", () => {
    const sanitized = sanitizeUsernameCandidate(".inv@lid-part!");
    expect(sanitized.startsWith("inv_lid")).toBe(true);
    expect(sanitized.length).toBeGreaterThanOrEqual(USERNAME_MIN_LENGTH);
    expect(sanitized.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
  });

  it("falls back to a default when sanitization removes everything", () => {
    const sanitized = sanitizeUsernameCandidate("***");
    expect(sanitized).toBe("user".padEnd(USERNAME_MIN_LENGTH, "0"));
  });

  it("derives username pairs from email addresses", () => {
    const result = deriveUsernamePairFromEmail("Ada+labs@example.dev");
    expect(result.username).toEqual(result.displayUsername.toLowerCase());
    expect(result.displayUsername).not.toContain("@");
  });

  it("derives seeds from multiple sources with sane fallback", () => {
    expect(deriveUsernameSeed({ displayUsername: "Custom" })).toBe("Custom");

    expect(deriveUsernameSeed({ email: "user.alias@example.com" })).toBe(
      "user.alias",
    );

    expect(deriveUsernameSeed({ name: "!" })).toBe("user0");
  });

  it("appends numeric suffixes without exceeding maximum length", () => {
    const base = "a".repeat(USERNAME_MAX_LENGTH);
    const withSuffix = withNumericSuffix(base, 42);
    expect(withSuffix.endsWith("42")).toBe(true);
    expect(withSuffix.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
  });

  it("derives username pairs with suffixes", () => {
    const result = deriveUsernamePairWithSuffix("Display", 7);
    expect(result.displayUsername).toBe("Display7");
    expect(result.username).toBe("display7");
  });
});
