import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./visual",
  timeout: 120_000,
  fullyParallel: true,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    browserName: "chromium",
    baseURL: "http://127.0.0.1:4173",
    hasTouch: true,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "landscape", viewport: { width: 1024, height: 768 } },
    { name: "portrait", viewport: { width: 768, height: 1024 } },
  ].map(({ name, viewport }) => ({
    name: `chromium-${name}`,
    use: { viewport },
  })),
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
