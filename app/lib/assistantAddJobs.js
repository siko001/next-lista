// Lives outside the assistant components so a running add continues across
// client-side navigation and can be observed from the root layout.
let jobs = [];
const listeners = new Set();

const publish = (next) => {
    jobs = next;
    for (const listener of listeners) listener();
};

const update = (id, patch) => publish(jobs.map((job) =>
    job.id === id ? {...job, ...patch} : job
));

export const getAssistantAddJobs = () => jobs;
export const subscribeAssistantAddJobs = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
export const dismissAssistantAddJob = (id) => publish(jobs.filter((job) => job.id !== id));

export async function runAssistantAddJob({items, listName, addItem}) {
    const products = items.map((item) => item.trim()).filter(Boolean);
    if (!products.length) throw new Error("There are no items to add.");

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    publish([...jobs, {
        id,
        listName: listName || "your list",
        done: 0,
        total: products.length,
        status: "running",
        visible: false,
    }]);
    const showTimer = setTimeout(() => update(id, {visible: true}), 650);
    let done = 0;
    try {
        for (const product of products) {
            await addItem(product);
            done += 1;
            update(id, {done});
        }
        clearTimeout(showTimer);
        const wasVisible = jobs.some((job) => job.id === id && job.visible);
        if (wasVisible) {
            update(id, {status: "complete", visible: true});
            setTimeout(() => dismissAssistantAddJob(id), 3500);
        } else {
            dismissAssistantAddJob(id);
        }
        return {done, total: products.length};
    } catch (cause) {
        clearTimeout(showTimer);
        update(id, {status: "error", done, visible: true});
        const error = new Error(cause?.message || "Some items could not be added.");
        error.completed = done;
        error.remainingItems = products.slice(done);
        throw error;
    }
}
