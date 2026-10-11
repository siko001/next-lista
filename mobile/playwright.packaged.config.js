import {defineConfig} from "@playwright/test";

export default defineConfig({
    testDir: "./tests/packaged",
    outputDir: "./.cache/playwright-packaged",
    workers: 1,
    timeout: 30000,
    use: {baseURL: "http://127.0.0.1:4174", channel: "chrome"},
    webServer: {
        command: "npm run preview -- --port 4174 --strictPort",
        url: "http://127.0.0.1:4174",
        reuseExistingServer: false,
    },
});
