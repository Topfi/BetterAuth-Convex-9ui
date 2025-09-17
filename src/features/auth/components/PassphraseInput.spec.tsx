import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PassphraseInput } from "./PassphraseInput";

describe("PassphraseInput", () => {
  it("previews the passphrase for five seconds before rehiding", () => {
    vi.useFakeTimers();

    try {
      function Harness() {
        const [value, setValue] = useState("");

        return (
          <PassphraseInput
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Test passphrase"
          />
        );
      }

      render(<Harness />);

      const input = screen.getByPlaceholderText("Test passphrase");
      const previewButton = screen.getByRole("button", {
        name: /preview passphrase/i,
      });

      expect(input).toHaveAttribute("type", "password");
      expect(previewButton).toBeDisabled();

      fireEvent.change(input, { target: { value: "correct horse battery" } });

      expect(previewButton).toBeEnabled();

      fireEvent.click(previewButton);

      expect(input).toHaveAttribute("type", "text");

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(input).toHaveAttribute("type", "password");
    } finally {
      vi.useRealTimers();
    }
  });
});
