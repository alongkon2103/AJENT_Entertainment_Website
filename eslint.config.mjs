import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored Tikkies demo app + overlay pages (not our code).
    "public/**",
    "lib/generated/**",
  ]),
  // Uploaded and CMS images are plain <img>; next/image would need remotePatterns for every source.
  { rules: { "@next/next/no-img-element": "off" } },
]);

export default eslintConfig;
