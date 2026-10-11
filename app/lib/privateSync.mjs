// Only a revision marker is polled. Private contents are fetched separately
// through the same membership-checked REST endpoints used by the app.
export function createPrivateSync({readSession, readRevision, changed, active = () => true,
    schedule = setTimeout, cancel = clearTimeout, interval = 4000}) {
    let timer, controller, running = false, paused = false, generation = 0;
    let previousSession, previousRevision;
    async function tick() {
        if (!running || paused) return;
        const cycle = generation;
        const session = readSession();
        if (active() && session?.id && session?.token) {
            controller = new AbortController();
            try {
                const revision = await readRevision(session, controller.signal);
                const current = readSession();
                if (running && !paused && cycle === generation && current?.id === session.id && current?.token === session.token) {
                    const key = session.id + ':' + session.token;
                    if (key !== previousSession || revision !== previousRevision) {
                        previousSession = key; previousRevision = revision;
                        changed(session.id);
                    }
                }
            } catch { /* A network failure must never replace local data with an empty list. */ }
        }
        if (running && !paused && cycle === generation) timer = schedule(tick, interval);
    }
    function stopPending() { generation++; cancel(timer); controller?.abort(); }
    return {
        start() { if (running) return; running = true; paused = false; void tick(); },
        stop() { running = false; stopPending(); previousSession = previousRevision = undefined; },
        pause() { paused = true; stopPending(); },
        resume() { if (!running) return; stopPending(); paused = false; previousRevision = undefined; void tick(); },
    };
}
