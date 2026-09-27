// Durable, account-scoped queue. Credentials and component callbacks are never stored.
export const ASSISTANT_JOB_PREFIX = "lista:assistant-add:v1:";

export function createAssistantAddQueue({storage, withLock, resolveProduct, addProduct, onAdded = () => {}, onActivity = () => {}}) {
    let jobs = [];
    let session = null;
    let generation = 0;
    let pumping = null;
    const listeners = new Set();
    const waiters = new Map();
    const key = (job) => `${ASSISTANT_JOB_PREFIX}${job.userId}:${job.id}`;
    const publish = () => { for (const listener of listeners) listener(); };
    const save = (job) => {
        // Persist before publishing or performing the next mutation. A full/blocked
        // store must never silently turn this back into a volatile job.
        storage().setItem(key(job), JSON.stringify(job));
        jobs = [...jobs.filter((item) => item.id !== job.id), job];
        publish();
    };
    const refresh = () => {
        const next = [];
        if (session) {
            const store = storage();
            const prefix = `${ASSISTANT_JOB_PREFIX}${session.userId}:`;
            for (let i = 0; i < store.length; i++) {
                const storedKey = store.key(i);
                if (!storedKey?.startsWith(prefix)) continue;
                try {
                    const job = JSON.parse(store.getItem(storedKey));
                    if (String(job.userId) !== session.userId || key(job) !== storedKey || !job.listId ||
                        !Array.isArray(job.items) || !job.items.length || !job.items.every((item) => typeof item.title === "string") ||
                        job.total !== job.items.length || !Number.isInteger(job.done) || job.done < 0 || job.done > job.items.length ||
                        !["running", "error", "complete"].includes(job.status)) continue;
                    next.push(job);
                } catch { /* Ignore malformed records, without losing other jobs. */ }
            }
        }
        jobs = next.sort((a, b) => a.createdAt - b.createdAt);
        publish();
        for (const job of jobs) {
            if (job.status === "complete") settle(job);
            if (job.status === "error") settle(job, new Error(job.error));
        }
    };
    const settle = (job, cause) => {
        const waiter = waiters.get(job.id);
        if (!waiter) return;
        waiters.delete(job.id);
        if (cause) {
            const error = new Error(cause.message || "Could not add the items. Retry from the progress card.");
            error.jobId = job.id;
            error.completed = job.done;
            waiter.reject(error);
        } else waiter.resolve({done: job.done, total: job.total});
    };
    const pump = () => {
        if (!session || pumping) return pumping || Promise.resolve();
        const current = session;
        const version = generation;
        const active = () => generation === version && session === current;
        pumping = Promise.resolve().then(() => withLock(`lista:assistant-add:${current.userId}`, async () => {
            if (!active()) return;
            refresh(); // Another tab may have finished while we waited for the lock.
            let job;
            while (active() && (job = jobs.find((item) => item.status === "running"))) {
                onActivity(true);
                try {
                    while (job.done < job.total && active()) {
                        const item = job.items[job.done];
                        if (!item.productId) {
                            const productId = await resolveProduct(item.title, current);
                            if (!active()) return;
                            job = {...job, items: job.items.map((entry, index) => index === job.done ? {...entry, productId} : entry)};
                            save(job); // Replay an interrupted add using the very same product ID.
                        }
                        if (!active()) return;
                        const product = job.items[job.done];
                        await addProduct(job.listId, product.productId, current);
                        if (!active()) return;
                        job = {...job, done: job.done + 1};
                        save(job);
                        onAdded(job, product);
                    }
                    if (!active()) return;
                    job = {...job, status: "complete", error: null};
                    save(job);
                    settle(job);
                } catch (cause) {
                    if (!active()) return;
                    job = {...job, status: "error", error: cause.message || "Could not add the items."};
                    try { save(job); } catch {
                        jobs = jobs.map((item) => item.id === job.id ? job : item);
                        publish();
                    }
                    settle(job, cause);
                } finally { onActivity(false); }
            }
        })).catch((cause) => {
            for (const job of jobs) settle(job, cause);
        }).finally(() => {
            pumping = null;
            // A session change can occur while an old request is completing.
            if (session && generation !== version) void pump();
        });
        return pumping;
    };
    return {
        getSnapshot: () => jobs,
        subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
        setSession(next) {
            session = next?.userId && next?.token ? {...next, userId: String(next.userId)} : null;
            generation++;
            refresh();
            // Interrupted jobs resume on load. Failed jobs stay reviewable until retry.
            void pump();
        },
        enqueue({userId, listId, listName, items}) {
            if (!session || String(userId) !== session.userId || !listId) throw new Error("Please wait for your session to load and try again.");
            const products = items.map((title) => ({title: String(title).trim()})).filter((item) => item.title);
            if (!products.length) throw new Error("There are no items to add.");
            const job = {
                id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, userId: session.userId, listId,
                listName: listName || "your list", items: products, done: 0,
                total: products.length, status: "running", createdAt: Date.now(),
            };
            save(job);
            const task = new Promise((resolve, reject) => waiters.set(job.id, {resolve, reject}));
            void pump();
            return task;
        },
        retry(id) {
            const job = jobs.find((item) => item.id === id);
            if (!job || job.status !== "error") return;
            save({...job, status: "running", error: null});
            void pump();
        },
        dismiss(id) {
            const job = jobs.find((item) => item.id === id);
            if (!job || job.status === "running") return;
            storage().removeItem(key(job));
            jobs = jobs.filter((item) => item.id !== id);
            publish();
        },
        sync() { refresh(); void pump(); },
        drain: () => pump(),
    };
}
