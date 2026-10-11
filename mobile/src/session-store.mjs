// Synchronous reads for the shared UI; durable writes are serialized and flushed
// before a navigation that replaces the document (especially login and logout).
export function createSessionStore({read, write, now = Date.now, onError = () => {}}) {
    let entries = {};
    let pending = Promise.resolve();
    let failure;
    const persist = () => {
        const snapshot = JSON.parse(JSON.stringify(entries));
        pending = pending.then(async () => {
            try { await write(snapshot); failure = undefined; }
            catch (error) { failure = error; onError(error); }
        });
    };
    return {
        async initialize() {
            const stored = await read();
            entries = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
            let expired = false;
            for (const [name, entry] of Object.entries(entries)) {
                if (!entry || typeof entry.value !== "string" || (entry.expires != null && entry.expires <= now())) {
                    delete entries[name]; expired = true;
                }
            }
            if (expired) { persist(); await this.flush(); }
        },
        get(name) {
            const entry = entries[name];
            if (!entry || (entry.expires != null && entry.expires <= now())) return undefined;
            return entry.value;
        },
        set(name, value, options = {}) {
            const expires = options.maxAge != null ? now() + options.maxAge * 1000
                : options.expires ? new Date(options.expires).getTime() : null;
            entries[name] = {value: typeof value === "string" ? value : JSON.stringify(value), expires};
            persist();
        },
        delete(name) { delete entries[name]; persist(); },
        async flush() { await pending; if (failure) throw failure; },
    };
}
