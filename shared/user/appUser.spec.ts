import { describe, expect, it, vi } from "vitest";

import {
  mapAuthUserToAppUserDocument,
  sanitizeAppUserDocument,
} from "./appUser";
import type { AppUserDocument } from "./appUser";

describe("sanitizeAppUserDocument", () => {
  it("returns the document when it already matches the schema", () => {
    const now = Date.now();
    const document = sanitizeAppUserDocument({
      authUserId: "user_123",
      email: "user@example.com",
      name: "Test User",
      displayUsername: "TestUser",
      username: "testuser",
      image: "https://example.com/avatar.png",
      createdAt: now,
      updatedAt: now,
    });

    expect(document.authUserId).toBe("user_123");
  });

  it("throws when required fields are missing", () => {
    expect(() =>
      sanitizeAppUserDocument({
        authUserId: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as AppUserDocument),
    ).toThrowErrorMatchingInlineSnapshot(`[ZodError: [
  {
    "origin": "string",
    "code": "too_small",
    "minimum": 1,
    "inclusive": true,
    "path": [
      "authUserId"
    ],
    "message": "Auth user id is required"
  }
]]`);
  });
});

describe("mapAuthUserToAppUserDocument", () => {
  it("coerces nullish fields and timestamps", () => {
    const spyNow = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1700000000000)
      .mockReturnValueOnce(1700000000001);

    const mapped = mapAuthUserToAppUserDocument({
      id: "user_abc",
      email: null,
      name: "",
      displayUsername: undefined,
      username: "",
      image: null,
      createdAt: null,
      updatedAt: undefined,
    });

    expect(mapped).toEqual({
      authUserId: "user_abc",
      email: undefined,
      name: undefined,
      displayUsername: undefined,
      username: undefined,
      image: undefined,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    });

    spyNow.mockRestore();
  });

  it("normalizes date instances to epoch milliseconds", () => {
    const created = new Date("2024-01-01T00:00:00Z");
    const updated = new Date("2024-01-02T00:00:00Z");

    const mapped = mapAuthUserToAppUserDocument({
      id: "user_xyz",
      createdAt: created,
      updatedAt: updated,
    });

    expect(mapped.createdAt).toBe(created.getTime());
    expect(mapped.updatedAt).toBe(updated.getTime());
  });
});
