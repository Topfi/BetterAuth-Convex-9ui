import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LoadingOverlay } from "./LoadingOverlay";

describe("LoadingOverlay", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("locks interactions and announces status while visible", async () => {
    const { unmount } = render(<LoadingOverlay label="Loading application" />);

    await waitFor(() => {
      expect(document.documentElement.style.overflow).toBe("hidden");
    });

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(screen.getByText("Loading application")).toBeInTheDocument();

    const appRoot = document.getElementById("root");
    expect(appRoot?.getAttribute("aria-hidden")).toBe("true");
    expect(appRoot?.hasAttribute("inert")).toBe(true);
    expect(appRoot?.style.pointerEvents).toBe("none");

    unmount();

    await waitFor(() => {
      expect(document.documentElement.style.overflow).toBe("");
      expect(appRoot?.hasAttribute("inert")).toBe(false);
      expect(appRoot?.getAttribute("aria-hidden")).toBeNull();
      expect(appRoot?.style.pointerEvents).toBe("");
      expect(document.querySelector("[data-loading-overlay-root]")).toBeNull();
    });
  });
});
