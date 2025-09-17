import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/providers/theme-provider";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "Missing VITE_CONVEX_URL. Update your environment configuration.",
  );
}

const convex = new ConvexReactClient(convexUrl);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system">
      <ToastProvider>
        <ConvexBetterAuthProvider client={convex} authClient={authClient}>
          <App />
        </ConvexBetterAuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
