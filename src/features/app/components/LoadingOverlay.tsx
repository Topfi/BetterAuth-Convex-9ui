import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type LoadingOverlayProps = {
  label?: string;
};

let activeOverlays = 0;
let previousOverflow: string | null = null;
let previousRootAriaHidden: string | null = null;
let rootWasInert = false;
let previousRootPointerEvents: string | null = null;
let overlayContainer: HTMLDivElement | null = null;
let overlayContainerUsers = 0;

function ensureOverlayContainer() {
  if (typeof document === "undefined") {
    return null;
  }

  if (!overlayContainer) {
    overlayContainer = document.createElement("div");
    overlayContainer.setAttribute("data-loading-overlay-root", "");
    document.body.appendChild(overlayContainer);
  }

  overlayContainerUsers += 1;
  return overlayContainer;
}

function releaseOverlayContainer() {
  overlayContainerUsers = Math.max(overlayContainerUsers - 1, 0);

  if (
    overlayContainerUsers === 0 &&
    overlayContainer &&
    typeof document !== "undefined"
  ) {
    document.body.removeChild(overlayContainer);
    overlayContainer = null;
  }
}

function applyGlobalLocks() {
  if (typeof document === "undefined") {
    return;
  }

  if (previousOverflow === null) {
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }

  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  if (previousRootAriaHidden === null) {
    previousRootAriaHidden = root.getAttribute("aria-hidden");
  }

  root.setAttribute("aria-hidden", "true");

  if (!rootWasInert) {
    rootWasInert = root.hasAttribute("inert");
  }

  root.setAttribute("inert", "");

  if (previousRootPointerEvents === null) {
    previousRootPointerEvents = root.style.pointerEvents;
  }

  root.style.pointerEvents = "none";
}

function releaseGlobalLocks() {
  if (typeof document === "undefined") {
    return;
  }

  if (previousOverflow !== null) {
    document.documentElement.style.overflow = previousOverflow;
    previousOverflow = null;
  }

  const root = document.getElementById("root");
  if (!root) {
    previousRootAriaHidden = null;
    rootWasInert = false;
    previousRootPointerEvents = null;
    return;
  }

  if (previousRootAriaHidden === null) {
    root.removeAttribute("aria-hidden");
  } else {
    root.setAttribute("aria-hidden", previousRootAriaHidden);
  }

  if (rootWasInert) {
    root.setAttribute("inert", "");
  } else {
    root.removeAttribute("inert");
  }

  if (previousRootPointerEvents === null) {
    root.style.removeProperty("pointer-events");
  } else {
    root.style.pointerEvents = previousRootPointerEvents;
  }

  previousRootAriaHidden = null;
  rootWasInert = false;
  previousRootPointerEvents = null;
}

function PulseSpinner() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html:
            ".spinner_7NYg{animation:spinner_0KQs 1.2s cubic-bezier(0.52,.6,.25,.99) infinite}@keyframes spinner_0KQs{0%{r:0;opacity:1}100%{r:11px;opacity:0}}",
        }}
      />
      <circle
        className="spinner_7NYg"
        cx="12"
        cy="12"
        r="0"
        fill="currentColor"
      />
    </svg>
  );
}

export function LoadingOverlay({ label = "Loading" }: LoadingOverlayProps) {
  const [portalElement, setPortalElement] = useState<HTMLDivElement | null>(
    null,
  );

  useEffect(() => {
    const node = ensureOverlayContainer();
    setPortalElement(node);

    return () => {
      releaseOverlayContainer();
    };
  }, []);

  useEffect(() => {
    activeOverlays += 1;
    if (activeOverlays === 1) {
      applyGlobalLocks();
    }

    return () => {
      activeOverlays = Math.max(activeOverlays - 1, 0);
      if (activeOverlays === 0) {
        releaseGlobalLocks();
      }
    };
  }, []);

  if (!portalElement) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[1100] bg-background/80 backdrop-blur-sm">
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div
          role="status"
          aria-live="assertive"
          aria-atomic="true"
          className="flex flex-col items-center gap-4 text-muted-foreground"
        >
          <PulseSpinner />
          <span className="sr-only">{label}</span>
        </div>
      </div>
    </div>,
    portalElement,
  );
}
