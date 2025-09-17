import { z } from "zod";

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const usernamePattern = /^[a-zA-Z0-9_.]+$/u;
const DEFAULT_USERNAME_BASE = "user";
const fallbackUsername = DEFAULT_USERNAME_BASE.padEnd(USERNAME_MIN_LENGTH, "0");

const buildRangeMessage = (label: string) =>
  `${label} must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters.`;

const usernameBaseSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH, {
    message: buildRangeMessage("Username"),
  })
  .max(USERNAME_MAX_LENGTH, {
    message: buildRangeMessage("Username"),
  })
  .regex(usernamePattern, {
    message:
      "Usernames can only include letters, numbers, underscores, and dots.",
  });

export const normalizeUsername = (value: string) => value.toLowerCase();

export const usernameInputSchema = usernameBaseSchema;

export const displayUsernameSchema = usernameBaseSchema;

export const normalizedUsernameSchema = usernameBaseSchema.refine(
  (value) => value === normalizeUsername(value),
  {
    message: "Normalized usernames must be lowercase.",
  },
);

export const deriveUsernamePair = (rawValue: string) => {
  const displayUsername = usernameInputSchema.parse(rawValue);
  const username = normalizeUsername(displayUsername);
  return { username, displayUsername };
};

export type UsernameSeedSource = {
  username?: string | null;
  displayUsername?: string | null;
  email?: string | null;
  name?: string | null;
};

const allowedCharactersPattern = /[a-zA-Z0-9_.]/;

type SanitizedCandidate = {
  value: string;
  usedFallback: boolean;
};

const sanitizeUsernameCandidateInternal = (
  value: string,
): SanitizedCandidate => {
  const collapsed = Array.from(value.trim())
    .map((character) =>
      allowedCharactersPattern.test(character) ? character : "_",
    )
    .join("")
    .replace(/_{2,}/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "");

  if (collapsed.length === 0) {
    return {
      value: fallbackUsername,
      usedFallback: true,
    };
  }

  const truncated = collapsed.slice(0, USERNAME_MAX_LENGTH);
  const bounded =
    truncated.length >= USERNAME_MIN_LENGTH
      ? truncated
      : truncated.padEnd(USERNAME_MIN_LENGTH, "0");

  return {
    value: bounded.slice(0, USERNAME_MAX_LENGTH),
    usedFallback: false,
  };
};

export const sanitizeUsernameCandidate = (value: string) => {
  return sanitizeUsernameCandidateInternal(value).value;
};

const pickSanitized = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const sanitized = sanitizeUsernameCandidateInternal(value);
  return sanitized.usedFallback ? null : sanitized.value;
};

const defaultUsernameSeed = sanitizeUsernameCandidate(
  `${DEFAULT_USERNAME_BASE}0`,
);

export const deriveUsernameSeed = (source: UsernameSeedSource) => {
  const emailLocalPart = source.email?.split("@")[0] ?? null;

  return (
    pickSanitized(source.displayUsername) ??
    pickSanitized(source.username) ??
    pickSanitized(emailLocalPart) ??
    pickSanitized(source.name) ??
    defaultUsernameSeed
  );
};

export const deriveUsernamePairFromEmail = (email: string) => {
  const [localPart] = email.split("@");
  const candidate = sanitizeUsernameCandidate(localPart ?? "");
  const displayUsername = candidate;
  const username = normalizeUsername(candidate);
  return { username, displayUsername };
};

export const withNumericSuffix = (base: string, suffix: number) => {
  const suffixText = `${suffix}`;
  const trimmedBase = base.slice(
    0,
    Math.max(1, USERNAME_MAX_LENGTH - suffixText.length),
  );
  return `${trimmedBase}${suffixText}`;
};

export const deriveUsernamePairWithSuffix = (
  baseDisplayUsername: string,
  suffix: number,
) => {
  const displayUsername = withNumericSuffix(baseDisplayUsername, suffix);
  const username = normalizeUsername(displayUsername);
  return { username, displayUsername };
};

export { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, usernamePattern };
