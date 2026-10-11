import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateSync} from '../app/lib/privateSync.mjs';
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
    const state = {session: {id: '1', token: 'session-a'}, revision: 'a', calls: [], changes: [], timers: new Map(), active: true};
    let next = 0;
    const sync = createPrivateSync({readSession: () => state.session, active: () => state.active,
        readRevision: async (session, signal) => { state.calls.push({session, signal}); if (state.failure) throw new Error('Offline'); return state.revision; },
        changed: id => state.changes.push(id), schedule: fn => { state.timers.set(++next, fn); return next; }, cancel: id => state.timers.delete(id)});
    state.tick = async () => { const [id, fn] = state.timers.entries().next().value; state.timers.delete(id); await fn(); };
    return {state, sync};
}
test('refreshes initially and on changed revisions, not unchanged polls', async () => {
    const {state, sync} = fixture(); sync.start(); await flush(); await state.tick();
    assert.deepEqual(state.changes, ['1']); state.revision = 'b'; await state.tick(); assert.deepEqual(state.changes, ['1','1']); sync.stop(); assert.equal(state.timers.size,0);
});
test('network failure preserves data, retries, and pause aborts current request', async () => {
    const {state,sync} = fixture(); state.failure = true; sync.start(); await flush(); assert.equal(state.changes.length,0);
    state.failure = false; await state.tick(); sync.pause(); assert.equal(state.calls.at(-1).signal.aborted,true); assert.equal(state.timers.size,0);
    sync.resume(); await flush(); assert.equal(state.changes.length,2); sync.stop();
});
test('no network requests without a session or while hidden', async () => {
    const {state,sync} = fixture(); state.session = null; sync.start(); await flush(); assert.equal(state.calls.length,0);
    state.session = {id:'1',token:'a'}; state.active = false; await state.tick(); assert.equal(state.calls.length,0); sync.stop();
});
test('an obsolete session response never refreshes the next account', async () => {
    let resolve; let session = {id:'1',token:'a'}; const changes=[];
    const sync=createPrivateSync({readSession:()=>session,readRevision:()=>new Promise(r=>resolve=r),changed:id=>changes.push(id)});
    sync.start(); session={id:'2',token:'b'}; resolve('revision'); await flush(); assert.deepEqual(changes,[]); sync.stop();
});
