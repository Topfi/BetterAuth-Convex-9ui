import { defaultClientConditions, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@convex": path.resolve(__dirname, "./convex"),
    },
    conditions: ["@convex-dev/component-source", ...defaultClientConditions],
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(__dirname, "src/test/setup.ts")],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
