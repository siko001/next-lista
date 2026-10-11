import {Capacitor} from "@capacitor/core";
import {App} from "@capacitor/app";
import {Network} from "@capacitor/network";
import {Keyboard} from "@capacitor/keyboard";
import {pauseRealtime, resumeRealtime} from "./realtime.js";
import {incomingLink, internalPath} from "./urls.mjs";
import {router} from "./compat/navigation.js";
import {openExternal, publicOrigin} from "./platform.js";
import {flushSession} from "./session.js";

export async function initializeRuntime() {
    const native = Capacitor.isNativePlatform();
    document.documentElement.classList.add("lista-mobile", `lista-${Capacitor.getPlatform()}`);
    const cleanup = [];
    // Keep original WordPress URLs in the shared components. This adapter makes
    // the endpoint configurable exclusively for mobile.
    const originalFetch = window.fetch.bind(window);
    const originalWp = "https://yellowgreen-woodpecker-591324.hostingersite.com";
    window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith(`${originalWp}/wp-json/`) && originalWp !== __LISTA_CONFIG__.wordpressUrl) {
            const mapped = __LISTA_CONFIG__.wordpressUrl + url.slice(originalWp.length);
            input = input instanceof Request ? new Request(mapped, input) : mapped;
        }
        return originalFetch(input, init);
    };
    cleanup.push(() => { window.fetch = originalFetch; });

    const acceptLink = (url) => {
        const route = incomingLink(url, publicOrigin());
        if (route) router.push(route);
    };
    const externalClick = (event) => {
        const link = event.target.closest?.("a[href]");
        if (!link || event.defaultPrevented || event.button !== 0) return;
        const href = link.getAttribute("href");
        if (/^https?:/.test(href) && !internalPath(href, publicOrigin(), window.location.origin)) {
            event.preventDefault(); event.stopPropagation(); void openExternal(href);
        }
    };
    document.addEventListener("click", externalClick, true);
    cleanup.push(() => document.removeEventListener("click", externalClick, true));

    const visibility = () => {
        if (document.visibilityState === "hidden") pauseRealtime();
        else resumeRealtime();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("online", resumeRealtime);
    cleanup.push(() => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("online", resumeRealtime); });
    if (native) {
        const listeners = await Promise.all([
            App.addListener("appUrlOpen", ({url}) => acceptLink(url)),
            App.addListener("appStateChange", ({isActive}) => {
                if (isActive) {
                    window.dispatchEvent(new Event("pageshow"));
                    resumeRealtime();
                } else {
                    pauseRealtime();
                    window.dispatchEvent(new Event("pagehide"));
                    void flushSession().catch(() => {});
                }
            }),
            App.addListener("backButton", () => {
                const focused = document.activeElement;
                if (focused?.matches("input,textarea,[contenteditable=true]")) { focused.blur(); void Keyboard.hide(); return; }
                const dialogs = [...document.querySelectorAll('[role="dialog"]')];
                const dialog = dialogs.at(-1);
                if (dialog) {
                    const close = dialog.querySelector('button[aria-label^="Close"], button[aria-label^="Dismiss"]');
                    if (close) close.click();
                    else document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
                    return;
                }
                const assistantClose = document.querySelector('.ai-chat[aria-hidden="false"] button[aria-label="Close assistant"]');
                if (assistantClose) { assistantClose.click(); return; }
                if (document.querySelector("#header-settings-menu, .home-list-slot [id^='menu-']")) {
                    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
                    return;
                }
                if (window.location.pathname !== "/" || history.state?.listaDepth > 0) router.back();
                else void App.minimizeApp();
            }),
            Network.addListener("networkStatusChange", ({connected}) => {
                window.dispatchEvent(new Event(connected ? "online" : "offline"));
                if (!connected) pauseRealtime();
            }),
        ]);
        cleanup.push(...listeners.map((listener) => () => listener.remove()));
        const launch = await App.getLaunchUrl();
        if (launch?.url) acceptLink(launch.url);
        const network = await Network.getStatus();
        if (!network.connected) window.dispatchEvent(new Event("offline"));
    }
    return () => cleanup.forEach((dispose) => dispose());
}
