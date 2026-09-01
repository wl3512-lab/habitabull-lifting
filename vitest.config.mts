import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The one thing vitest needs that it cannot infer: the `@/` alias tsconfig
 * declares. Without it the API route's own imports do not resolve and the
 * handler cannot be tested at all.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
