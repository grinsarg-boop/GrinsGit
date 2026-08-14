import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Espeja el alias "@/*" → "./*" de tsconfig para que vitest resuelva los imports absolutos.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // .claude/worktrees son copias del repo que dejan las sesiones de Claude Code: sus tests son de
    // otra rama y se sumaban a la corrida. El total subía y bajaba segun cuantos worktrees hubiera
    // (118 archivos un rato antes, 95 despues, sin que se tocara un solo test), que es exactamente
    // lo que un contador de tests no puede hacer.
    exclude: ["**/node_modules/**", "**/dist/**", ".claude/**"],
  },
});
