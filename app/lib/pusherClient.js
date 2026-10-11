import {getCookie} from "cookies-next";
import {decryptToken, WP_API_BASE} from "./helpers";
import {refreshListData} from "./dataCache.mjs";
import {createPrivateSync} from "./privateSync.mjs";

let sync, references = 0;
function getSync() {
    if (!sync) {
        sync = createPrivateSync({
            readSession: () => ({id: getCookie("id"), token: decryptToken(getCookie("token"))}),
            active: () => document.visibilityState !== "hidden" && navigator.onLine !== false,
            readRevision: async (session, signal) => {
                const response = await fetch(`${WP_API_BASE}/custom/v1/sync-revision`, {
                    headers: {Authorization: `Bearer ${session.token}`}, cache: "no-store", signal,
                });
                if (!response.ok) throw new Error("Synchronization unavailable");
                const data = await response.json();
                if (typeof data.revision !== "string") throw new Error("Invalid synchronization response");
                return data.revision;
            },
            changed: refreshListData,
        });
        window.addEventListener("online", () => sync.resume());
        window.addEventListener("focus", () => sync.resume());
        document.addEventListener("visibilitychange", () => document.hidden ? sync.pause() : sync.resume());
        window.addEventListener("pagehide", () => sync.pause());
        window.addEventListener("pageshow", () => sync.resume());
    }
    return sync;
}
// Retain the existing hook interface while retiring every public subscription.
// The account hook drives authoritative refreshes; old payload-specific hooks
// receive no unverified data and can be removed independently.
export function subscribePusherEvent(channelName, eventName) {
    if (typeof window === "undefined" || eventName !== "lists-changed" || !/^user-lists-[0-9]+$/.test(channelName)) return () => {};
    references++; getSync().start();
    let released = false;
    return () => { if (released) return; released = true; if (--references === 0) sync.stop(); };
}
export function pauseRealtime() { sync?.pause(); }
export function resumeRealtime() { sync?.resume(); }
