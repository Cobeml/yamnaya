import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
config({ path: ".env.camps", quiet: true });
export default defineConfig({
  testDir: "./tests/camps-e2e",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.CAMP_PUBLIC_URL ?? "http://localhost:3110",
    viewport: { width: 1500, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/camps", open: "never" }],
  ],
});
