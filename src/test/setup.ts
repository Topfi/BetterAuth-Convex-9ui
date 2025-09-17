import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

afterEach(() => {
  cleanup();
});

beforeAll(async () => {
  if (typeof globalThis.TextEncoder === "undefined") {
    const { TextEncoder } = await import("util");
    globalThis.TextEncoder = TextEncoder;
  }
  if (typeof globalThis.TextDecoder === "undefined") {
    const { TextDecoder } = await import("util");
    // @ts-expect-error TextDecoder from util satisfies the runtime shape well enough for tests.
    globalThis.TextDecoder = TextDecoder;
  }
});
