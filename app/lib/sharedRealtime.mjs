// One remote connection for a group of same-origin browser tabs. Each tab keeps
// its own listeners; the lock owner forwards remote events over BroadcastChannel.
export function createSharedRealtime({createChannel, requestLock, subscribeRemote,
    tabId = globalThis.crypto.randomUUID(), now = Date.now,
    repeat = setInterval, cancelRepeat = clearInterval}) {
    const local = new Map();
    const peers = new Map();
    const remote = new Map();
    let channel;
    let heartbeat;
    let controller;
    let releaseLock;
    let leader = false;
    let paused = false;
    let generation = 0;
    const key = (name, event) => JSON.stringify([name, event]);
    const pairs = () => [...local.values()].map(({name, event}) => ({name, event}));
    const send = (message) => channel?.postMessage({...message, tabId});
    const announce = () => send({kind: "subscriptions", pairs: pairs()});
    const emit = (name, event, data) => {
        for (const handler of local.get(key(name, event))?.handlers || []) handler(data);
    };
    const reconcile = () => {
        if (!leader) return;
        const wanted = new Map(pairs().map((pair) => [key(pair.name, pair.event), pair]));
        for (const [id, peer] of peers) {
            if (now() - peer.seen > 90000) { peers.delete(id); continue; }
            for (const pair of peer.pairs) wanted.set(key(pair.name, pair.event), pair);
        }
        for (const [id, release] of remote) {
            if (!wanted.has(id)) { release(); remote.delete(id); }
        }
        for (const [id, pair] of wanted) {
            if (remote.has(id)) continue;
            remote.set(id, subscribeRemote(pair.name, pair.event, (data) => {
                emit(pair.name, pair.event, data);
                send({kind: "event", name: pair.name, event: pair.event, data});
            }));
        }
    };
    const stop = () => {
        generation++;
        send({kind: "leave"});
        if (heartbeat !== undefined) cancelRepeat(heartbeat);
        heartbeat = undefined;
        controller?.abort();
        releaseLock?.();
        releaseLock = undefined;
        leader = false;
        for (const release of remote.values()) release();
        remote.clear();
        peers.clear();
        channel?.close();
        channel = undefined;
    };
    const start = () => {
        if (channel || paused || !local.size) return;
        const version = ++generation;
        channel = createChannel();
        channel.onmessage = ({data}) => {
            if (!data || data.tabId === tabId) return;
            if (data.kind === "event") { emit(data.name, data.event, data.data); return; }
            if (["hello", "subscriptions"].includes(data.kind) && Array.isArray(data.pairs)) {
                peers.set(data.tabId, {pairs: data.pairs.filter((pair) => typeof pair.name === "string" && typeof pair.event === "string"), seen: now()});
                reconcile();
                if (data.kind === "hello") announce();
            } else if (data.kind === "leave") { peers.delete(data.tabId); reconcile(); }
            else if (data.kind === "leader") announce();
        };
        send({kind: "hello", pairs: pairs()});
        heartbeat = repeat(() => { announce(); reconcile(); }, 10000);
        controller = new AbortController();
        // A queued lock request takes over automatically when its owner closes.
        requestLock(controller.signal, async () => {
            if (generation !== version || paused) return;
            leader = true;
            const held = new Promise((resolve) => { releaseLock = resolve; });
            send({kind: "leader"});
            reconcile();
            await held;
        }).catch((error) => {
            if (error?.name === "AbortError" || generation !== version) return;
            // If lock acquisition fails, retain remote delivery in this tab.
            leader = true;
            reconcile();
        });
    };
    return {
        subscribe(name, event, handler) {
            const id = key(name, event);
            if (!local.has(id)) local.set(id, {name, event, handlers: new Set()});
            local.get(id).handlers.add(handler);
            start();
            announce();
            reconcile();
            return () => {
                const entry = local.get(id);
                entry?.handlers.delete(handler);
                if (!entry?.handlers.size) local.delete(id);
                if (!local.size) stop();
                else { announce(); reconcile(); }
            };
        },
        pause() { paused = true; stop(); },
        resume() { paused = false; start(); },
    };
}
