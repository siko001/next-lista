import {defineConfig} from "@playwright/test";
export default defineConfig({
    testDir: "./tests/ui",
    fullyParallel: false,
    workers: 1,
    timeout: 30000,
    use: {
        baseURL: "http://127.0.0.1:4173",
        channel: "chrome",
        viewport: {width: 412, height: 915},
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    webServer: {command: "npm run dev", url: "http://127.0.0.1:4173", reuseExistingServer: true},
});
