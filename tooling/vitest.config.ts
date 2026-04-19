import { defineConfig } from "vitest/config";
import path from "path";

// Tests import server modules that validate runtime env eagerly.
process.env.SKIP_ENV_VALIDATION = process.env.SKIP_ENV_VALIDATION ?? "1";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.spec.ts",
      "src/**/*.spec.tsx",
      "src/**/*.property.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.spec.ts",
        "src/**/*.spec.tsx",
        "src/**/*.property.test.ts",
        "src/**/__tests__/**",
      ],
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "../src"),
    },
  },
});
