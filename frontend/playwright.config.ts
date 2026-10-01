import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: [
    {
      command: "npm run dev",
      cwd: path.join(here, "../backend"),
      port: 3333,
      reuseExistingServer: true,
      timeout: 90_000,
    },
    {
      command: "npm run dev",
      cwd: here,
      port: 5173,
      reuseExistingServer: false,
      timeout: 90_000,
    },
  ],
});