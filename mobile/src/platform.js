import {Capacitor} from "@capacitor/core";
import {Browser} from "@capacitor/browser";
import {Clipboard} from "@capacitor/clipboard";
import {Share} from "@capacitor/share";
import {getCookie, flushSession} from "./session.js";
import {hostedApiUrl, internalPath} from "./urls.mjs";

export const publicOrigin = () => __LISTA_CONFIG__.webUrl;
export const sessionUserId = () => getCookie("id") || null;
export const apiUrl = (path) => Capacitor.isNativePlatform() ? hostedApiUrl(path, publicOrigin()) : path;
export async function openExternal(value) {
    const url = new URL(value, publicOrigin());
    if (!["https:", "http:"].includes(url.protocol)) return;
    if (Capacitor.isNativePlatform()) await Browser.open({url: url.href});
    else window.open(url.href, "_blank", "noopener,noreferrer");
}
export async function navigate(value, {replace = false} = {}) {
    const path = internalPath(value, publicOrigin(), window.location.origin);
    if (!path) return openExternal(value);
    try {
        await flushSession();
        if (replace) window.location.replace(path);
        else window.location.href = path;
    } catch {
        window.dispatchEvent(new CustomEvent("lista:mobile-error", {detail: "Your session could not be saved. Please try again."}));
    }
}
export const reloadPage = () => navigate(window.location.pathname + window.location.search, {replace: true});
export async function shareLink(url) {
    if (!Capacitor.isNativePlatform()) return false;
    try { await Share.share({title: "Lista", text: "Sharing this list with you", url, dialogTitle: "Share your list"}); }
    catch { /* Dismissing the system share sheet leaves the dialog open. */ }
    return true;
}
export const copyText = (text) => Capacitor.isNativePlatform()
    ? Clipboard.write({string: text}) : navigator.clipboard.writeText(text);
