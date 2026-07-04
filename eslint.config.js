import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * Guard against reintroducing raw `new Date()` current-moment reads in feature
 * code. All "now" reads must route through helpers in `src/lib/timeUtils.ts`.
 * The helpers themselves and the low-level `src/lib/tz.ts` primitives are the
 * only sanctioned callers of the zero-arg Date constructor.
 */
const NO_RAW_NOW = {
  selector: "NewExpression[callee.name='Date'][arguments.length=0]",
  message:
    "Do not call `new Date()` for current time. Use helpers from '@/lib/timeUtils' (getSystemNowDate/getSystemTodayStr/getSystemTimestamp).",
};

export default tseslint.config(
  { ignores: ["dist"] },
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
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/timeUtils.ts",
      "src/lib/tz.ts",
      "src/test/**",
      "src/**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": ["error", NO_RAW_NOW],
    },
  },
);
