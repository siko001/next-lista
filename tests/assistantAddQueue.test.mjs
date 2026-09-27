import test from "node:test";
import assert from "node:assert/strict";
import {createAssistantAddQueue, ASSISTANT_JOB_PREFIX} from "../app/lib/assistantAddQueue.mjs";

function storage() {
    const values = new Map();
    return {
        get length() { return values.size; },
        key: (index) => [...values.keys()][index] ?? null,
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
    };
}
const session = {userId: 7, token: "secret-session-token"};
const deferred = () => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return {promise, resolve};
};
function makeQueue(store, overrides = {}) {
    return createAssistantAddQueue({
        storage: () => store,
        withLock: (_name, run) => run(),
        resolveProduct: async (title) => ({Milk: 11, Bread: 12, Eggs: 13})[title],
        addProduct: async () => {},
        ...overrides,
    });
}
const enqueue = (queue, extra = {}) => queue.enqueue({userId: 7, listId: 99, listName: "Weekly", items: ["Milk", "Bread", "Eggs"], ...extra});

test("refresh resumes at the last checkpoint and replays an uncertain add with the same product ID", async () => {
    const store = storage();
    const secondStarted = deferred();
    const response = deferred();
    const linked = new Set();
    const requests = [];
    const add = async (list, id) => { requests.push([list, id]); linked.add(id); };
    const old = makeQueue(store, {addProduct: async (list, id) => {
        await add(list, id);
        if (id === 12) { secondStarted.resolve(); await response.promise; }
    }});
    old.setSession(session);
    const pending = enqueue(old);
    pending.catch(() => {});
    await secondStarted.promise;
    assert.equal(old.getSnapshot()[0].done, 1);
    assert.equal(old.getSnapshot()[0].items[1].productId, 12);
    assert.equal(store.getItem(store.key(0)).includes(session.token), false);
    // The old page disappears after WordPress commits, before the response arrives.
    old.setSession(null);
    response.resolve();
    await old.drain();
    const resumedResolutions = [];
    const fresh = makeQueue(store, {
        resolveProduct: async (title) => { resumedResolutions.push(title); return 13; },
        addProduct: add,
    });
    fresh.setSession(session);
    await fresh.drain();
    assert.deepEqual(requests, [[99, 11], [99, 12], [99, 12], [99, 13]]);
    assert.deepEqual([...linked], [11, 12, 13]);
    assert.deepEqual(resumedResolutions, ["Eggs"]);
    assert.equal(fresh.getSnapshot()[0].status, "complete");
    assert.equal(fresh.getSnapshot()[0].done, 3);
});

test("an accepted batch is persisted before any network work", async () => {
    const store = storage();
    let requests = 0;
    const queue = makeQueue(store, {addProduct: async () => { requests++; }});
    queue.setSession(session);
    const result = enqueue(queue);
    assert.equal(requests, 0);
    const saved = JSON.parse(store.getItem(store.key(0)));
    assert.equal(saved.listId, 99);
    assert.deepEqual(saved.items, [{title: "Milk"}, {title: "Bread"}, {title: "Eggs"}]);
    assert.deepEqual(await result, {done: 3, total: 3});
});

test("failed jobs retain their destination and retry only unfinished items", async () => {
    const store = storage();
    let fail = true;
    const calls = [];
    const queue = makeQueue(store, {addProduct: async (list, id) => {
        calls.push([list, id]);
        if (id === 12 && fail) throw new Error("Offline");
    }});
    queue.setSession(session);
    await assert.rejects(enqueue(queue), (error) => error.completed === 1 && Boolean(error.jobId));
    await queue.drain();
    assert.equal(queue.getSnapshot()[0].status, "error");
    const fresh = makeQueue(store, {addProduct: async (list, id) => calls.push([list, id])});
    fresh.setSession(session);
    await fresh.drain();
    assert.equal(calls.length, 2, "failed jobs do not spin on reload");
    fail = false;
    fresh.retry(fresh.getSnapshot()[0].id);
    await fresh.drain();
    assert.deepEqual(calls, [[99, 11], [99, 12], [99, 12], [99, 13]]);
    assert.equal(fresh.getSnapshot()[0].status, "complete");
});

test("another account cannot see, resume, or enqueue the previous user's work", async () => {
    const store = storage();
    const first = deferred();
    const response = deferred();
    const old = makeQueue(store, {addProduct: async () => { first.resolve(); await response.promise; }});
    old.setSession(session);
    enqueue(old).catch(() => {});
    await first.promise;
    old.setSession(null);
    response.resolve();
    await old.drain();
    let writes = 0;
    const fresh = makeQueue(store, {addProduct: async () => { writes++; }});
    fresh.setSession({userId: 8, token: "other-token"});
    await fresh.drain();
    assert.deepEqual(fresh.getSnapshot(), []);
    assert.throws(() => enqueue(fresh), /session/);
    assert.equal(writes, 0);
    fresh.setSession(session);
    await fresh.drain();
    assert.equal(writes, 3);
});

test("two tabs sharing a lock cannot execute the same batch twice", async () => {
    const store = storage();
    let tail = Promise.resolve();
    const withLock = (_name, run) => {
        const task = tail.then(run);
        tail = task.catch(() => {});
        return task;
    };
    const started = deferred();
    const release = deferred();
    const calls = [];
    const options = {withLock, addProduct: async (_list, id) => {
        calls.push(id);
        if (id === 11) { started.resolve(); await release.promise; }
    }};
    const first = makeQueue(store, options);
    first.setSession(session);
    const task = enqueue(first);
    await started.promise;
    const second = makeQueue(store, options);
    second.setSession(session);
    release.resolve();
    await task;
    await second.drain();
    assert.deepEqual(calls, [11, 12, 13]);
    assert.equal(second.getSnapshot()[0].status, "complete");
});

test("storage failure rejects a new job before creating or adding products", async () => {
    const store = storage();
    let writes = 0;
    const queue = makeQueue(store, {addProduct: async () => { writes++; }});
    queue.setSession(session);
    store.setItem = () => { throw new Error("Storage full"); };
    assert.throws(() => enqueue(queue), /Storage full/);
    await queue.drain();
    assert.equal(writes, 0);
    assert.deepEqual(queue.getSnapshot(), []);
});

test("completed jobs never rerun after reload; dismiss removes the saved record", async () => {
    const store = storage();
    const first = makeQueue(store);
    first.setSession(session);
    await enqueue(first);
    let writes = 0;
    const fresh = makeQueue(store, {addProduct: async () => { writes++; }});
    fresh.setSession(session);
    await fresh.drain();
    assert.equal(writes, 0);
    fresh.dismiss(fresh.getSnapshot()[0].id);
    assert.equal(store.length, 0);
});

test("a corrupt saved record does not prevent other batches from continuing", async () => {
    const store = storage();
    store.setItem(`${ASSISTANT_JOB_PREFIX}7:broken`, "{");
    const queue = makeQueue(store);
    queue.setSession(session);
    await enqueue(queue, {items: ["Milk"]});
    assert.equal(queue.getSnapshot()[0].status, "complete");
});
