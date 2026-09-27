import test from "node:test";
import assert from "node:assert/strict";
import {
    cachedRead, cachedValue, cacheVersion, seedCache, invalidateCache,
    invalidateSessionData, cacheKeys, CACHE_TTL, subscribeListInvalidation, invalidateListData,
} from "../app/lib/dataCache.mjs";

const values = new Map();
const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
};
globalThis.window = {sessionStorage: storage};
globalThis.document = {cookie: "id=7"};
globalThis.BroadcastChannel = undefined;

test("deduplicates reads and expires the catalogue", async () => {
    let now = 1000;
    const originalNow = Date.now;
    Date.now = () => now;
    try {
        let calls = 0;
        const load = async () => { calls++; return [{id: calls}]; };
        const [first, second] = await Promise.all([
            cachedRead(cacheKeys.catalogue, 100, load),
            cachedRead(cacheKeys.catalogue, 100, load),
        ]);
        assert.deepEqual(first, second);
        assert.equal(calls, 1);
        assert.deepEqual(await cachedRead(cacheKeys.catalogue, 100, load), first);
        now += 101;
        assert.deepEqual(await cachedRead(cacheKeys.catalogue, 100, load), [{id: 2}]);
    } finally { Date.now = originalNow; invalidateCache(cacheKeys.catalogue); }
});

test("isolates account data and clears only the account on logout", () => {
    seedCache(cacheKeys.lists(7), [{id: 1, acf: {owner_token: "private-jwt", owner_id: 7}}], CACHE_TTL.lists);
    assert.equal(values.get("lista:data:v3:user:7:lists").includes("private-jwt"), false);
    seedCache(cacheKeys.lists(8), [{id: 2}], CACHE_TTL.lists);
    seedCache(cacheKeys.catalogue, [{id: 3}], CACHE_TTL.catalogue);
    invalidateSessionData(7);
    assert.equal(cachedValue(cacheKeys.lists(7)), undefined);
    assert.deepEqual(cachedValue(cacheKeys.lists(8)), [{id: 2}]);
    assert.deepEqual(cachedValue(cacheKeys.catalogue), [{id: 3}]);
    invalidateCache("user:", cacheKeys.catalogue);
});

test("an invalidated in-flight response cannot repopulate the cache", async () => {
    const key = cacheKeys.lists(7);
    const before = cacheVersion(key);
    let resolveFirst;
    const first = cachedRead(key, 1000, () => new Promise(resolve => { resolveFirst = resolve; }));
    await Promise.resolve();
    invalidateCache(key);
    assert.equal(cacheVersion(key), before + 1);
    const second = cachedRead(key, 1000, async () => [{id: "new"}]);
    resolveFirst([{id: "old"}]);
    await Promise.all([first, second]);
    assert.deepEqual(cachedValue(key), [{id: "new"}]);
    invalidateCache(key);
});

test("a forced refresh wins over an older request", async () => {
    const key = cacheKeys.lists(9);
    let resolveOld;
    const old = cachedRead(key, 1000, () => new Promise(resolve => { resolveOld = resolve; }));
    await Promise.resolve();
    const fresh = cachedRead(key, 1000, async () => [{id: "fresh"}], {force: true});
    await fresh;
    resolveOld([{id: "stale"}]);
    await old;
    assert.deepEqual(cachedValue(key), [{id: "fresh"}]);
    invalidateCache(key);
});


test("other-tab invalidations refresh only the matching account without rebroadcasting", () => {
    const previousWindow = globalThis.window;
    const target = new EventTarget();
    globalThis.window = {
        sessionStorage: storage,
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
        dispatchEvent: target.dispatchEvent.bind(target),
    };
    let channel;
    globalThis.BroadcastChannel = class {
        constructor() { channel = this; this.sent = []; }
        postMessage(data) { this.sent.push(data); }
    };
    let updates = 0;
    const unsubscribe = subscribeListInvalidation(7, () => updates++);
    try {
        channel.onmessage({data: {prefixes: [cacheKeys.lists(8)]}});
        assert.equal(updates, 0);
        channel.onmessage({data: {prefixes: [cacheKeys.lists(7)]}});
        assert.equal(updates, 1);
        assert.equal(channel.sent.length, 0, "receiving does not cause a broadcast loop");
        invalidateListData(7);
        assert.equal(updates, 1, "the originating tab keeps its optimistic view");
        assert.deepEqual(channel.sent, [{prefixes: [cacheKeys.lists(7)]}]);
        unsubscribe();
        channel.onmessage({data: {prefixes: [cacheKeys.lists(7)]}});
        assert.equal(updates, 1);
    } finally {
        unsubscribe();
        globalThis.window = previousWindow;
        globalThis.BroadcastChannel = undefined;
    }
});
