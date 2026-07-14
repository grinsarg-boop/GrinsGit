import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Espeja el alias "@/*" → "./*" de tsconfig para que vitest resuelva los imports absolutos.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
