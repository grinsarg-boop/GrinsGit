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
    // Artefactos de herramientas, no código: .claude cuelga worktrees (cada uno con su .next)
    // y .vercel guarda el output del build. Directorios enteros: adentro no vive fuente nuestra.
    ".claude/**",
    ".vercel/**",
    // Scripts de dev/reconciliación: se corren con tsx, no van en el bundle. Fuera del lint de la app.
    "scripts/**",
  ]),
]);

export default eslintConfig;
