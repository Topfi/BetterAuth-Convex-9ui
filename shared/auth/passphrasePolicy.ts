import { zxcvbn, zxcvbnOptions, type ZxcvbnResult } from "@zxcvbn-ts/core";
import {
  adjacencyGraphs,
  dictionary as commonDictionary,
} from "@zxcvbn-ts/language-common";
import {
  dictionary as englishDictionary,
  translations as englishTranslations,
} from "@zxcvbn-ts/language-en";

export interface PassphrasePolicy {
  minLength: number;
  minScore: number;
  previewDurationMs: number;
}

export const passphraseStrengthLabels = [
  "Very weak",
  "Weak",
  "Fair",
  "Good",
  "Excellent",
] as const;

export type PassphraseStrengthLabel = (typeof passphraseStrengthLabels)[number];

export type PassphraseStrengthTone = "danger" | "warning" | "info" | "success";

export interface PassphraseStrengthDescriptor {
  score: number;
  normalizedScore: number;
  label: PassphraseStrengthLabel;
  tone: PassphraseStrengthTone;
  meetsScoreRequirement: boolean;
  guidance: string;
}

const passphraseStrengthTones = [
  "danger",
  "danger",
  "warning",
  "success",
  "success",
] as const satisfies readonly PassphraseStrengthTone[];

const passphraseStrengthGuidance = [
  "Add length and uncommon words, then mix in numbers or symbols until the meter turns green.",
  "Keep building; pair unrelated words and add numbers or symbols until the meter turns green.",
  "Almost there. Keep stretching until strength reads Good or better.",
  "Great work. Add one more unique element to push it even further.",
  "Excellent strength. Store it safely (recommending a passphrase manager) and never reuse it for other purposes.",
] as const;

export const passphrasePolicy: PassphrasePolicy = {
  minLength: 16,
  minScore: 3,
  previewDurationMs: 5_000,
};

let isConfigured = false;

const configureZxcvbn = () => {
  if (isConfigured) {
    return;
  }

  zxcvbnOptions.setOptions({
    translations: englishTranslations,
    dictionary: {
      ...commonDictionary,
      ...englishDictionary,
    },
    graphs: adjacencyGraphs,
  });
  isConfigured = true;
};

export function evaluatePassphrase(passphrase: string): ZxcvbnResult {
  configureZxcvbn();
  return zxcvbn(passphrase);
}

export type PassphrasePolicyFailureCode = "too_short" | "too_weak";

export interface PassphrasePolicyFailure {
  code: PassphrasePolicyFailureCode;
  message: string;
}

export interface PassphraseValidationResult {
  result: ZxcvbnResult;
  failures: PassphrasePolicyFailure[];
  isValid: boolean;
}

export function validatePassphrase(
  passphrase: string,
): PassphraseValidationResult {
  const result = evaluatePassphrase(passphrase);
  const descriptor = getPassphraseStrengthDescriptor(result.score);
  const failures: PassphrasePolicyFailure[] = [];

  if (passphrase.length < passphrasePolicy.minLength) {
    failures.push({
      code: "too_short",
      message: `Passphrases must include at least ${passphrasePolicy.minLength} characters.`,
    });
  }

  if (descriptor.normalizedScore < passphrasePolicy.minScore) {
    const feedback = result.feedback.warning || result.feedback.suggestions[0];
    failures.push({
      code: "too_weak",
      message:
        feedback && feedback.trim().length > 0 ? feedback : descriptor.guidance,
    });
  }

  return {
    result,
    failures,
    isValid: failures.length === 0,
  };
}

export function getPassphraseStrengthDescriptor(
  score: number,
): PassphraseStrengthDescriptor {
  const normalizedScore = Math.min(
    Math.max(Math.round(score), 0),
    passphraseStrengthLabels.length - 1,
  );

  const meetsScoreRequirement = normalizedScore >= passphrasePolicy.minScore;

  return {
    score,
    normalizedScore,
    label: passphraseStrengthLabels[normalizedScore],
    tone: passphraseStrengthTones[normalizedScore],
    guidance: passphraseStrengthGuidance[normalizedScore],
    meetsScoreRequirement,
  };
}

export function getPassphraseStrengthLabel(
  score: number,
): PassphraseStrengthLabel {
  return getPassphraseStrengthDescriptor(score).label;
}
