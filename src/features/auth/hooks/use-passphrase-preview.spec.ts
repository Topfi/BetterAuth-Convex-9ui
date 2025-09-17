import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePassphrasePreview } from "./use-passphrase-preview";

describe("usePassphrasePreview", () => {
  it("reveals immediately and hides after the preview window", () => {
    vi.useFakeTimers();

    try {
      const { result } = renderHook(() => usePassphrasePreview());

      expect(result.current.isRevealed).toBe(false);

      act(() => {
        result.current.preview();
      });

      expect(result.current.isRevealed).toBe(true);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.isRevealed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
