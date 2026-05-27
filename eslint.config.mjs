import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import i18next from "eslint-plugin-i18next";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // i18n: forbid hardcoded user-visible strings in components/pages. New strings
  // must go through t() with a key in src/i18n/en.json. LLM-facing files (see
  // ignores below) keep English in source because they're fed to the model.
  {
    files: ["src/components/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": ["warn", {
        markupOnly: true,
        onlyAttribute: ["title", "placeholder", "alt", "aria-label", "label"],
        ignoreCallee: [
          "t", "i18next.t",
          "console.log", "console.error", "console.warn", "console.info", "console.debug",
          "Error", "TypeError", "RangeError",
          "cn", "clsx", "tw",
          "require", "import",
        ],
        ignoreAttribute: [
          "className", "class", "id", "name", "type", "role", "key",
          "href", "src", "style", "value", "defaultValue",
          "to", "as", "for", "htmlFor", "form",
          "data-*", "aria-hidden", "aria-controls", "aria-describedby", "aria-labelledby",
          "viewBox", "fill", "stroke", "d", "xmlns",
          "rel", "target", "method", "encType", "accept",
          "placeholder",
        ],
        ignoreProperty: [
          "className", "id", "key", "displayName", "name", "type",
          "color", "bg", "icon", "iconName",
          "path", "url", "src", "href",
          "test", "match", "regex",
        ],
      }],
    },
  },
  {
    ignores: [
      "dist/**",
      "build/**",
      "src-tauri/**",
      "tauri-plugin-mcp/**",
      "outlook-addin/**",
      "scripts/**",
      // LLM-facing strings: prompts, agent files, tool descriptions. These are
      // intentionally English in source because the model reads them.
      "src/lib/ai/prompts.ts",
      "src/lib/ai/**/prompts.ts",
      "src/lib/assistant/**",
      "src/lib/context-index/agent-context.ts",
      "src/lib/context-index/artifacts.ts",
    ],
  }
);
