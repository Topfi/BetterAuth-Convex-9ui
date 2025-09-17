import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "convex/_generated/**/*",
      "src/components/ui/**/*",
      ".tsbuild/**/*",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["convex/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*"],
              message:
                "Convex code must import shared utilities via @shared instead of client modules.",
            },
            {
              group: ["../src/*", "../../src/*"],
              message:
                "Do not reach into src/ from Convex functions. Promote shared helpers into @shared.",
            },
          ],
        },
      ],
    },
  },
);
