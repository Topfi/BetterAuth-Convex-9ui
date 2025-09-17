import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@zxcvbn-ts/core", () => ({
  zxcvbn: vi.fn(),
  zxcvbnOptions: {
    setOptions: vi.fn(),
  },
}));

import { zxcvbn } from "@zxcvbn-ts/core";
import type { ZxcvbnResult } from "@zxcvbn-ts/core";

import {
  getPassphraseStrengthDescriptor,
  passphrasePolicy,
  validatePassphrase,
} from "./passphrasePolicy";

const createResult = (overrides: Partial<ZxcvbnResult> = {}): ZxcvbnResult => ({
  feedback: overrides.feedback ?? { warning: "", suggestions: [] },
  crackTimesSeconds: overrides.crackTimesSeconds ?? {
    onlineThrottling100PerHour: 0,
    onlineNoThrottling10PerSecond: 0,
    offlineSlowHashing1e4PerSecond: 0,
    offlineFastHashing1e10PerSecond: 0,
  },
  crackTimesDisplay: overrides.crackTimesDisplay ?? {
    onlineThrottling100PerHour: "centuries",
    onlineNoThrottling10PerSecond: "centuries",
    offlineSlowHashing1e4PerSecond: "centuries",
    offlineFastHashing1e10PerSecond: "centuries",
  },
  score: overrides.score ?? 0,
  password: overrides.password ?? "",
  guesses: overrides.guesses ?? 0,
  guessesLog10: overrides.guessesLog10 ?? 0,
  sequence: overrides.sequence ?? [],
  calcTime: overrides.calcTime ?? 0,
});

const zxcvbnMock = vi.mocked(zxcvbn);

describe("passphrasePolicy", () => {
  beforeEach(() => {
    zxcvbnMock.mockReset();
  });

  it("rejects passphrases shorter than the minimum length", () => {
    zxcvbnMock.mockReturnValue(createResult({ score: 4 }));

    const { failures, isValid } = validatePassphrase("short-pass");

    expect(isValid).toBe(false);
    expect(failures).toEqual([
      expect.objectContaining({
        code: "too_short",
        message: expect.stringContaining(
          `${passphrasePolicy.minLength} characters`,
        ),
      }),
    ]);
  });

  it("rejects passphrases that do not reach the score minimum", () => {
    zxcvbnMock.mockReturnValue(createResult({ score: 1 }));
    const longPassphrase = "long enough but still weak".repeat(2);

    const { failures, isValid } = validatePassphrase(longPassphrase);

    expect(isValid).toBe(false);
    expect(failures).toEqual([expect.objectContaining({ code: "too_weak" })]);
  });

  it("classifies strength guidance based on zxcvbn score", () => {
    const descriptor = getPassphraseStrengthDescriptor(
      passphrasePolicy.minScore,
    );

    expect(descriptor.meetsScoreRequirement).toBe(true);
    expect(descriptor.tone).toBe("success");
    expect(descriptor.guidance.length).toBeGreaterThan(0);
  });
});
