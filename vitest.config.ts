import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "coverage",
      include: ["lib/**/*.ts", "tests/**/*.ts"],
      exclude: [
        "lib/db/**",
        "lib/auth/**",
        "lib/storage/**",
        "lib/stripe/**",
        "lib/sms/**",
        "lib/email/**",
        "lib/notifications/**",
        "lib/utils.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "test"),
  },
  optimizeDeps: {
    exclude: ["@prisma/client"],
  },
})

