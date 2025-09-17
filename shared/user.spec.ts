import { describe, expect, it } from "vitest";

import { deriveUserDisplayName, deriveUserInitial } from "./user";

describe("user display helpers", () => {
  it("prefers a display username when available", () => {
    const user = {
      displayUsername: "AdaLovelace",
      username: "adalovelace",
      name: "Ada",
      email: "ada@example.com",
    };

    expect(deriveUserDisplayName(user)).toBe("AdaLovelace");
    expect(deriveUserInitial(user)).toBe("A");
  });

  it("falls back to the trimmed name when no username is set", () => {
    const user = { name: "  Ada Lovelace  ", email: "ada@example.com" };

    expect(deriveUserDisplayName(user)).toBe("Ada Lovelace");
    expect(deriveUserInitial(user)).toBe("A");
  });

  it("falls back to the email local part when name is missing", () => {
    const user = { name: "", email: "engineer+test@example.com" };

    expect(deriveUserDisplayName(user)).toBe("engineer+test");
    expect(deriveUserInitial(user)).toBe("E");
  });

  it("uses safe defaults when no identifier is available", () => {
    const user = { name: null, email: "   " };

    expect(deriveUserDisplayName(user)).toBe("Account");
    expect(deriveUserInitial(user)).toBe("?");
  });
});
