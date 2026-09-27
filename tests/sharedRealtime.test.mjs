import test from "node:test";
import assert from "node:assert/strict";
import {createSharedRealtime} from "../app/lib/sharedRealtime.mjs";

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function environment() {
    const channels = new Set();
    const remote = new Map();
    const pending = [];
    let held = false;
    const grant = () => {
        if (held) return;
        let next;
        while ((next = pending.shift())) {
            if (next.signal.aborted) continue;
            held = true;
            Promise.resolve(next.run()).then(next.resolve, next.reject).finally(() => { held = false; grant(); });
            break;
        }
    };
    const requestLock = (signal, run) => new Promise((resolve, reject) => {
        pending.push({signal, run, resolve, reject});
        signal.addEventListener("abort", () => {
            if (pending.some((item) => item.signal === signal)) reject(Object.assign(new Error("aborted"), {name: "AbortError"}));
        });
        grant();
    });
    const createChannel = () => {
        const channel = {onmessage: null,
            postMessage(data) { for (const peer of channels) if (peer !== channel) queueMicrotask(() => peer.onmessage?.({data})); },
            close() { channels.delete(channel); channel.onmessage = null; },
        };
        channels.add(channel);
        return channel;
    };
    const tab = (id) => createSharedRealtime({tabId: id, requestLock, createChannel,
        repeat: () => 1, cancelRepeat: () => {},
        subscribeRemote: (name, event, handler) => {
            const key = `${name}:${event}`;
            assert.equal(remote.has(key), false, `duplicate remote binding for ${key}`);
            remote.set(key, {owner: id, handler});
            return () => remote.delete(key);
        },
    });
    return {tab, remote, emit: (name, event, data) => remote.get(`${name}:${event}`).handler(data)};
}

test("tabs share one remote owner and retain all remote event subscriptions", async () => {
    const env = environment();
    const a = env.tab("a");
    const b = env.tab("b");
    const seenA = [];
    const seenB = [];
    const stopA = a.subscribe("shopping-list-1", "list-updated", (data) => seenA.push(data));
    const stopB = b.subscribe("shopping-list-2", "list-updated", (data) => seenB.push(data));
    await flush();
    assert.equal(env.remote.size, 2);
    assert.deepEqual([...new Set([...env.remote.values()].map((item) => item.owner))], ["a"]);
    env.emit("shopping-list-2", "list-updated", {sender_id: 42, action: "bag"});
    await flush();
    assert.deepEqual(seenA, []);
    assert.deepEqual(seenB, [{sender_id: 42, action: "bag"}]);
    stopA();
    await flush();
    assert.equal(env.remote.size, 1);
    assert.equal([...env.remote.values()][0].owner, "b");
    env.emit("shopping-list-2", "list-updated", {sender_id: 42, action: "unbag"});
    await flush();
    assert.equal(seenB.length, 2);
    stopB();
    await flush();
    assert.equal(env.remote.size, 0);
});

test("same-channel listeners receive one copy and unsubscribing one tab preserves the other", async () => {
    const env = environment();
    const a = env.tab("a"), b = env.tab("b");
    let countA = 0, countB = 0;
    const stopA = a.subscribe("user-lists-7", "share-update", () => countA++);
    const stopB = b.subscribe("user-lists-7", "share-update", () => countB++);
    await flush();
    assert.equal(env.remote.size, 1);
    env.emit("user-lists-7", "share-update", {action: "add"});
    await flush();
    assert.equal(countA, 1);
    assert.equal(countB, 1);
    stopB();
    await flush();
    env.emit("user-lists-7", "share-update", {action: "remove"});
    assert.equal(countA, 2);
    assert.equal(countB, 1);
    stopA();
});

test("refreshing the owner hands off its connection; restoring it does not duplicate the socket", async () => {
    const env = environment();
    const a = env.tab("a"), b = env.tab("b");
    let count = 0;
    const stopA = a.subscribe("shopping-list-1", "list-updated", () => count++);
    const stopB = b.subscribe("shopping-list-1", "list-updated", () => {});
    await flush();
    a.pause();
    await flush();
    assert.equal([...env.remote.values()][0].owner, "b");
    a.resume();
    await flush();
    assert.equal(env.remote.size, 1);
    assert.equal([...env.remote.values()][0].owner, "b");
    env.emit("shopping-list-1", "list-updated", {sender_id: 8});
    await flush();
    assert.equal(count, 1);
    stopA(); stopB();
});
