export type BasicUser = {
  name?: string | null;
  email?: string | null;
  username?: string | null;
  displayUsername?: string | null;
};

const sanitize = (value?: string | null) => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getEmailLocalPart = (value?: string | null) => {
  const sanitizedEmail = sanitize(value);
  if (!sanitizedEmail) {
    return null;
  }
  const [localPart] = sanitizedEmail.split("@");
  return sanitize(localPart);
};

const getBestIdentifier = ({
  name,
  email,
  displayUsername,
  username,
}: BasicUser) => {
  return (
    sanitize(displayUsername) ??
    sanitize(username) ??
    sanitize(name) ??
    getEmailLocalPart(email) ??
    sanitize(email)
  );
};

export const deriveUserDisplayName = (user: BasicUser) => {
  return getBestIdentifier(user) ?? "Account";
};

export const deriveUserInitial = (user: BasicUser) => {
  const identifier = getBestIdentifier(user);
  if (!identifier) {
    return "?";
  }
  const [firstChar] = identifier;
  return firstChar ? firstChar.toUpperCase() : "?";
};
