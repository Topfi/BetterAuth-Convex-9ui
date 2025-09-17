import { useEffect, useRef, useState } from "react";

import { passphrasePolicy } from "@shared/auth";

export const usePassphrasePreview = (
  durationMs = passphrasePolicy.previewDurationMs,
) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const hide = () => {
    if (timeoutRef.current !== null) {
      globalThis.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsRevealed(false);
  };

  const preview = () => {
    hide();
    setIsRevealed(true);
    timeoutRef.current = globalThis.setTimeout(() => {
      timeoutRef.current = null;
      setIsRevealed(false);
    }, durationMs);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        globalThis.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [durationMs]);

  return {
    isRevealed,
    preview,
    hide,
  };
};
