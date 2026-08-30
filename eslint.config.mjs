import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    ".agents/**",
    ".claude/**",
    "**/.claude/**",
    "next-env.d.ts",
    "src/generated/**",
    "seed/**",
    "test/**",
  ]),
]);

export default eslintConfig;
