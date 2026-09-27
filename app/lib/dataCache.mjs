// Small, session-scoped cache for browser reads. Keys contain resource IDs, never tokens.
// WordPress remains the source of truth; expired and invalidated entries are not served.
export const CACHE_TTL = Object.freeze({
    catalogue: 10 * 60 * 1000,
    profile: 5 * 60 * 1000,
    customProducts: 5 * 60 * 1000,
    favourites: 2 * 60 * 1000,
    lists: 30 * 1000,
});

const PREFIX = "lista:data:v3:";
const entries = new Map();
const pending = new Map();
const versions = new Map();
let channel;
let legacyCleared = false;

function browser() { return typeof window !== "undefined"; }
function storageKey(key) { return PREFIX + key; }

function clearLegacyStorage() {
    if (!browser() || legacyCleared) return;
    legacyCleared = true;
    try {
        for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
            const key = window.sessionStorage.key(index);
            if (key?.startsWith("lista:data:v1:") || key?.startsWith("lista:data:v2:")) {
                window.sessionStorage.removeItem(key);
            }
        }
    } catch {}
}

function read(key) {
    const inMemory = entries.get(key);
    if (inMemory) {
        if (inMemory.expires > Date.now()) return inMemory.value;
        entries.delete(key);
    }
    if (!browser()) return undefined;
    try {
        const raw = window.sessionStorage.getItem(storageKey(key));
        if (!raw) return undefined;
        const saved = JSON.parse(raw);
        if (saved.expires > Date.now()) {
            entries.set(key, saved);
            return saved.value;
        }
        window.sessionStorage.removeItem(storageKey(key));
    } catch {
        // Disabled or full storage only removes persistence, not the live cache.
    }
    return undefined;
}

export function cachedValue(key) { getChannel(); return read(key); }
export function cacheVersion(key) { return versions.get(key) || 0; }

export function seedCache(key, value, ttl) {
    if (!browser() || value === undefined || value === null) return;
    getChannel();
    // WordPress ACF can include owner_token in list responses. Keep credentials
    // out of storage even if the caller accidentally passes the full object.
    let safeValue = value;
    if (key.startsWith("user:")) {
        try {
            safeValue = JSON.parse(JSON.stringify(value, (field, item) =>
                /token|password|secret|nonce|share.?code|authorization/i.test(field) ? undefined : item));
        } catch { return; }
    }
    const entry = {value: safeValue, expires: Date.now() + ttl};
    entries.set(key, entry);
    try { window.sessionStorage.setItem(storageKey(key), JSON.stringify(entry)); } catch {}
}

export async function cachedRead(key, ttl, load, {force = false} = {}) {
    if (!browser()) return load();
    getChannel();
    if (force) clearPrefixes([key]);
    if (!force) {
        const value = read(key);
        if (value !== undefined) return value;
        if (pending.has(key)) return pending.get(key);
    }
    const version = versions.get(key) || 0;
    const request = Promise.resolve().then(load).then((value) => {
        if ((versions.get(key) || 0) === version) seedCache(key, value, ttl);
        return value;
    }).finally(() => {
        if (pending.get(key) === request) pending.delete(key);
    });
    pending.set(key, request);
    return request;
}

function clearPrefixes(prefixes) {
    for (const key of new Set([...entries.keys(), ...pending.keys(), ...versions.keys()])) {
        if (prefixes.some((prefix) => key.startsWith(prefix))) {
            entries.delete(key);
            pending.delete(key);
            versions.set(key, (versions.get(key) || 0) + 1);
        }
    }
    if (!browser()) return;
    try {
        for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
            const stored = window.sessionStorage.key(index);
            if (stored?.startsWith(PREFIX) && prefixes.some((prefix) => stored.slice(PREFIX.length).startsWith(prefix))) {
                window.sessionStorage.removeItem(stored);
            }
        }
    } catch {}
}

function getChannel() {
    if (!browser()) return null;
    clearLegacyStorage();
    if (typeof BroadcastChannel === "undefined") return null;
    if (!channel) {
        channel = new BroadcastChannel("lista-data-cache-v3");
        channel.onmessage = (event) => {
            if (event.data?.kind === "logout") {
                window.dispatchEvent(new CustomEvent("lista:logout", {detail: event.data.userId}));
                return;
            }
            if (Array.isArray(event.data?.prefixes)) {
                clearPrefixes(event.data.prefixes);
                window.dispatchEvent(new CustomEvent("lista:cache-invalidated", {detail: event.data.prefixes}));
            }
        };
    }
    return channel;
}

export function invalidateCache(...prefixes) {
    if (!prefixes.length) return;
    clearPrefixes(prefixes);
    getChannel()?.postMessage({prefixes});
}

export const cacheKeys = {
    catalogue: "catalogue",
    profile: (userId) => `user:${userId}:profile`,
    lists: (userId) => `user:${userId}:lists`,
    customProducts: (userId) => `user:${userId}:custom-products`,
    favourites: (userId) => `user:${userId}:favourites`,
};

export function invalidateListData(userId) {
    if (userId) invalidateCache(cacheKeys.lists(userId));
}

export function currentCacheUserId() {
    if (!browser()) return null;
    const match = document.cookie.match(/(?:^|;\s*)id=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export function invalidateCurrentLists() {
    invalidateListData(currentCacheUserId());
}

export function invalidateCurrentProducts({catalogue = false} = {}) {
    const userId = currentCacheUserId();
    if (catalogue) invalidateCache(cacheKeys.catalogue);
    if (userId) invalidateCache(cacheKeys.customProducts(userId), cacheKeys.favourites(userId));
}

export function invalidateProductData(userId) {
    invalidateCache(cacheKeys.catalogue);
    if (userId) invalidateCache(cacheKeys.customProducts(userId), cacheKeys.favourites(userId));
}

export function invalidateSessionData(userId) {
    if (userId) invalidateCache(`user:${userId}:`);
}

export function announceLogout(userId) {
    if (userId) getChannel()?.postMessage({kind: "logout", userId: String(userId)});
}
