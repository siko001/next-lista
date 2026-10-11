import {test, expect} from "@playwright/test";
import CryptoJS from "crypto-js";

const token = CryptoJS.AES.encrypt(JSON.stringify("test.payload.signature"), "your-secret-key-123").toString();

for (const platform of ["android", "ios"]) {
    test(`${platform} packaged startup loads secure storage, dismisses the splash and respects system bars`, async ({page}) => {
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        // Exercise the real native JS adapter and production chunks. Mock only
        // the OS bridge, so circular dynamic-import waits cannot be hidden.
        await page.addInitScript(({platform, token}) => {
            const session = Object.fromEntries(Object.entries({token, id: "7", registered: "yes", username: '{"userName":"Test"}'})
                .map(([key, value]) => [key, {value, expires: null}]));
            const methods = {
                SecureStorage: ["internalGetItem", "internalSetItem", "setSynchronizeKeychain"],
                App: ["getLaunchUrl", "addListener", "removeListener"],
                Network: ["getStatus", "addListener", "removeListener"],
                SplashScreen: ["hide"],
            };
            if (platform === "android") window.androidBridge = {};
            else window.webkit = {messageHandlers: {bridge: {}}};
            window.nativeCalls = [];
            const applyInsets = () => {
                document.documentElement.style.setProperty("--safe-area-inset-top", "48px");
                document.documentElement.style.setProperty("--safe-area-inset-bottom", "48px");
            };
            if (document.documentElement) applyInsets();
            else document.addEventListener("DOMContentLoaded", applyInsets, {once: true});
            window.Capacitor = {
                PluginHeaders: Object.entries(methods).map(([name, names]) => ({name,
                    methods: names.map((name) => ({name, rtype: name === "addListener" ? "callback" : "promise"})),
                })),
                nativeCallback: () => "test-listener",
                nativePromise: async (plugin, method) => {
                    window.nativeCalls.push(`${plugin}.${method}`);
                    if (method === "internalGetItem") return {data: JSON.stringify(session)};
                    if (method === "getStatus") return {connected: true, connectionType: "wifi"};
                    return {};
                },
            };
        }, {platform, token});
        await page.route("**/*", (route) => {
            if (new URL(route.request().url()).origin === "http://127.0.0.1:4174") return route.continue();
            if (route.request().url().includes("/user-data")) return route.fulfill({json: {id: 7, name: "Test", registered: "yes"}});
            return route.fulfill({json: []});
        });
        await page.routeWebSocket(/pusher\.com/, (socket) => socket.close());
        await page.goto("/", {waitUntil: "commit"});
        await expect.poll(() => page.evaluate(() => window.nativeCalls)).toContain("SplashScreen.hide");
        await expect(page.getByRole("heading", {name: "Shopping lists", exact: true})).toBeVisible();
        await expect(page.locator("#root")).toHaveCSS("padding-top", "48px");
        const header = await page.locator(".app-navigation").boundingBox();
        expect(header.y).toBeGreaterThanOrEqual(48);
        expect(await page.evaluate(() => window.nativeCalls)).toContain("SecureStorage.internalGetItem");
        expect(errors).toEqual([]);
    });
}

test("privacy remains readable when secure storage fails without creating a replacement guest account", async ({page}) => {
    const backendRequests = [];
    await page.addInitScript(() => {
        window.androidBridge = {};
        window.Capacitor = {
            PluginHeaders: [
                {name: "SecureStorage", methods: ["internalGetItem", "internalSetItem"].map(name => ({name, rtype: "promise"}))},
                {name: "SplashScreen", methods: [{name: "hide", rtype: "promise"}]},
            ],
            nativePromise: async (_plugin, method) => {
                if (method === "internalGetItem") throw new Error("Keychain unavailable");
                return {};
            },
        };
    });
    await page.route("**/wp-json/**", route => { backendRequests.push(route.request().url()); return route.abort(); });
    await page.goto("/privacy");
    await expect(page.getByRole("heading", {name: "Lista privacy policy"})).toBeVisible();
    await page.getByRole("link", {name: "Lista account deletion instructions"}).click();
    await expect(page.getByRole("heading", {name: "Delete your Lista account"})).toBeVisible();
    await page.getByRole("link", {name: "Back to Lista"}).click();
    await expect(page.getByRole("alert")).toContainText("couldn’t open its secure session");
    expect(backendRequests).toEqual([]);
});
