import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bun run dev -- --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173", reuseExistingServer: false,
      env: { VITE_API_URL: "http://127.0.0.1:3099", VITE_BASE_PATH: "" },
    },
    // Production layout: the main site and the demo on separate origins
    // (localhost:4175 / demo.localhost:4175, both this server). e2e/demo-subdomain.spec.ts
    {
      command: "bun run dev -- --host 127.0.0.1 --port 4175 --strictPort",
      url: "http://127.0.0.1:4175", reuseExistingServer: false,
      env: { VITE_API_URL: "http://127.0.0.1:3099", VITE_BASE_PATH: "", VITE_APP_URL: "http://localhost:4175", VITE_DEMO_URL: "http://demo.localhost:4175" },
    },
  ],
});
