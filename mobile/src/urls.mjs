export function internalPath(value, webOrigin, localOrigin) {
    try {
        // Protocol-relative input is never an app route.
        if (typeof value !== "string" || value.startsWith("//")) return null;
        if (value.startsWith("/") && !value.includes("\\")) return value;
        const url = new URL(value);
        const localIOS = url.protocol === "capacitor:" && url.hostname === "localhost" && localOrigin === "null";
        if ((!localIOS && (!["https:", "http:"].includes(url.protocol) || ![webOrigin, localOrigin].includes(url.origin))) || url.username || url.password) return null;
        return url.pathname + url.search + url.hash;
    } catch { return null; }
}

export function incomingLink(value, webOrigin) {
    try {
        const url = new URL(value);
        if (url.origin !== webOrigin || url.username || url.password) return null;
        if (!/^\/(?:shared-list\/\d+|list\/\d+|reset-password|password-reset|login)\/?$/.test(url.pathname)) return null;
        return url.pathname + url.search;
    } catch { return null; }
}

export function hostedApiUrl(path, origin) {
    if (!path.startsWith("/api/") || path.includes("\\")) throw new Error("Invalid API path");
    const url = new URL(path, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/api/")) throw new Error("Invalid API path");
    return url.href;
}
