import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: "http://localhost:5174",
  },
  webServer: [
    {
      command: "bun --env-file=.env.test --watch src/index.ts",
      cwd: "../server",
      url: "http://localhost:3002/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "bun run dev -- --port 5174",
      cwd: "../client",
      url: "http://localhost:5174",
      env: { VITE_SERVER_URL: "http://localhost:3002" },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
