import test from "node:test";
import assert from "node:assert/strict";
import {createSessionStore} from "../src/session-store.mjs";

test("session writes remain ordered through login and immediate logout; flush waits for disk", async () => {
    let saved;
    const store = createSessionStore({read: async () => null, write: async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 2)); saved = value;
    }});
    await store.initialize();
    store.set("token", "guest"); store.set("token", "account"); store.set("id", 123);
    assert.equal(store.get("token"), "account");
    store.delete("token"); store.delete("id");
    await store.flush();
    assert.deepEqual(saved, {});
});
test("expired sessions are removed and object cookie values retain web-compatible encoding", async () => {
    let stored = {token: {value: "old", expires: 99}, theme: {value: "dark", expires: null}};
    const store = createSessionStore({read: async () => stored, write: async (value) => { stored = value; }, now: () => 100});
    await store.initialize();
    assert.equal(store.get("token"), undefined);
    assert.equal(store.get("theme"), "dark");
    store.set("username", {userName: "Neil"}, {maxAge: 60});
    await store.flush();
    assert.equal(store.get("username"), '{"userName":"Neil"}');
    assert.equal(stored.username.expires, 60100);
});
test("failed secure writes prevent navigation flush; subsequent successful write recovers", async () => {
    let fail = true;
    const store = createSessionStore({read: async () => null, write: async () => { if (fail) throw new Error("Locked"); }});
    await store.initialize(); store.set("token", "first");
    await assert.rejects(store.flush(), /Locked/);
    fail = false; store.set("token", "second"); await store.flush();
    assert.equal(store.get("token"), "second");
});
test("a secure-storage read failure never silently creates a replacement guest session", async () => {
    const store = createSessionStore({read: async () => { throw new Error("Locked"); }, write: async () => {}});
    await assert.rejects(store.initialize(), /Locked/);
});
