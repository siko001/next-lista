// Explicit integration check against Lista's live backend, using only data
// created by this run. Never point these checks at existing customer IDs.
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import assert from 'node:assert/strict';

if (!process.argv.includes('--create-test-data')) throw new Error('Pass --create-test-data to create two test guest accounts and disposable fixtures.');
const base = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const statePath = resolve(root, '.cache', `live-guards-${stamp}.json`);
const state = {createdAt: stamp, accounts: [], lists: [], products: [], checks: [], cleanup: []};
await mkdir(resolve(root, '.cache'), {recursive: true});
const save = () => writeFile(statePath, JSON.stringify(state, null, 2), {mode: 0o600});
const check = (condition, label) => { assert.ok(condition, label); state.checks.push(label); console.log(`PASS ${label}`); };
const status = (response, expected, label) => check(response.status === expected, `${label} (HTTP ${response.status})`);
async function api(path, actor = null, method = 'GET', body) {
    const response = await fetch(base + path, {
        method, redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: {Accept: 'application/json', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache',
            ...(actor ? {Authorization: `Bearer ${actor.token}`} : {})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    const data = await response.json();
    return {status: response.status, data, cache: response.headers.get('cache-control')};
}
function noCredentials(value) {
    if (!value || typeof value !== 'object') return true;
    return Object.entries(value).every(([key, item]) =>
        !['owner_token', 'token', 'user_pass', 'user_activation_key', 'share_code', 'share_code_expires'].includes(key)
        && noCredentials(item));
}
async function guest(label) {
    const created = await api('/custom/v1/create-user', null, 'POST', {});
    status(created, 200, `Create test guest ${label}`);
    const account = {id: created.data.user_id, username: created.data.username, label};
    state.accounts.push(account); await save();
    check(typeof created.data.token === 'string' && created.data.token.split('.').length === 3, `Guest ${label} receives a signed session directly`);
    account.token = created.data.token; await save();
    const session = await api('/jwt-auth/v1/token', null, 'POST', {username: account.username, password: 'lista123'});
    status(session, 200, `Legacy client can redeem one-time ticket ${label}`);
    const replay = await api('/jwt-auth/v1/token', null, 'POST', {username: account.username, password: 'lista123'});
    check(replay.status >= 400, `One-time guest ticket ${label} cannot be replayed`);
    return account;
}
async function list(actor) {
    const result = await api('/wp/v2/shopping-list', actor, 'POST', {
        title: `Lista permission check ${actor.label} ${stamp}`, status: 'publish', menu_order: 0,
        acf: {owner_id: actor.id, owner_token: 'integration-check-placeholder'},
    });
    status(result, 201, `Create ${actor.label} test list`);
    const fixture = {id: result.data.id, actor: actor.label}; state.lists.push(fixture); await save();
    return fixture;
}
async function product(actor, fixture) {
    const result = await api('/custom/v1/create-custom-product', actor, 'POST', {title: `Permission check ${actor.label}`});
    status(result, 200, `Create ${actor.label} test product`);
    const entry = {id: result.data.id, actor: actor.label, list: fixture.id}; state.products.push(entry); await save();
    return entry;
}
try {
    const a = await guest('A'); const b = await guest('B');
    const la = await list(a); const lb = await list(b);
    const pa = await product(a, la); const pb = await product(b, lb);
    const path = `/custom/v1/shopping-list/${la.id}`;
    status(await api(path), 401, 'Anonymous cannot read test list');
    status(await api(`/custom/v1/shopping-lists-by-owner/${a.id}`), 401, 'Anonymous cannot read test account summaries');
    const owned = await api(path, a);
    status(owned, 200, 'Owner can read test list');
    check(noCredentials(owned.data), 'List read omits nested credentials');
    check(/private/.test(owned.cache) && /no-store/.test(owned.cache), 'Owner list response is private and uncached');
    const summaries = await api(`/custom/v1/shopping-lists-by-owner/${a.id}`, a);
    status(summaries, 200, 'Owner can read summaries');
    check(noCredentials(summaries.data), 'Summaries omit credentials');
    status(await api(path, b), 403, 'Unrelated account cannot read test list');
    status(await api(`/custom/v1/shopping-lists-by-owner/${a.id}`, b), 403, 'Unrelated account cannot read summaries');
    status(await api(`${path}?id=${lb.id}`, a), 400, 'Query cannot substitute a different list ID');
    status(await api(`/CUSTOM/v1/SHOPPING-LIST/${la.id}/`, b), 403, 'Mixed-case route cannot bypass membership');
    status(await api('/custom/v1/get-shopping-list-products?shoppingListId=' + la.id, b), 403, 'Unrelated account cannot read list products');
    status(await api('/custom/v1/copy-shopping-list', b, 'POST', {source_list_id: la.id, new_menu_order: 0}), 403, 'Unrelated account cannot copy list');
    status(await api('/wp/v2/shopping-list/order', b, 'POST', {orders: [{id: lb.id, menu_order: 9}, {id: la.id, menu_order: 8}]}), 403, 'Mixed-ownership reorder batch is rejected');
    const unchanged = await api('/wp/v2/shopping-list/' + lb.id, b);
    check(unchanged.data.menu_order === 0, 'Rejected reorder leaves earlier batch rows untouched');
    status(await api('/custom/v1/delete-custom-product', b, 'POST', {shoppingListId: lb.id, productId: pa.id}), 403, 'Cannot delete another account product');
    status(await api('/custom/v1/delete-custom-product', a, 'POST', {shoppingListId: la.id, productId: la.id}), 403, 'Cannot use product deletion to delete a shopping list');
    status(await api('/custom/v1/share-list', b, 'POST', {list_id: la.id, user_id: b.id}), 403, 'Legacy share route rejects outsider self-addition');
    const invite = await api('/custom/v1/generate-share-code', a, 'POST', {list_id: la.id});
    status(invite, 200, 'Owner can generate invitation');
    assert.ok(invite.data.code);
    status(await api('/custom/v1/accept-shared-list', b, 'POST', {list_id: la.id, user_id: b.id, code: invite.data.code}), 200, 'Invited account can join');
    status(await api(path, b), 200, 'Shared member can read list');
    status(await api('/custom/v1/delete-custom-product', b, 'POST', {shoppingListId: la.id, productId: pa.id}), 403, 'Membership does not grant ownership of custom products');
    status(await api('/custom/v1/remove-user-from-shared', b, 'POST', {listId: la.id, userId: a.id}), 403, 'Member cannot remove owner');
    status(await api('/custom/v1/remove-user-from-shared', b, 'POST', {listId: String(la.id), userId: String(b.id), notifyUsers: {ownerId: 0, removedUserId: 0}}), 200, 'Member can leave using string IDs');
    status(await api(path, b), 403, 'Departed member loses list access');
    status(await api('/custom/v1/share-list', a, 'POST', {list_id: la.id, user_id: b.id}), 200, 'Owner can use legacy direct share');
    status(await api('/custom/v1/remove-user-from-shared', a, 'POST', {listId: la.id, userId: b.id}), 200, 'Owner can remove member');
    status(await api(path, b), 403, 'Removed member loses list access');
    status(await api('/wp/v2/shopping-list/order', a, 'POST', {orders: [{id: la.id, menu_order: 1}]}), 200, 'Authorized reorder succeeds');
} catch (error) {
    state.failure = error.message;
    console.error('CHECK FAILED:', error.message);
    process.exitCode = 1;
} finally {
    // Cleanup is restricted to IDs recorded from this run's successful creations.
    for (const entry of state.products) {
        const actor = state.accounts.find(a => a.label === entry.actor);
        try {
            const result = await api('/custom/v1/delete-custom-product', actor, 'POST', {shoppingListId: entry.list, productId: entry.id});
            state.cleanup.push({kind: 'product', id: entry.id, status: result.status});
            if (result.status !== 200) process.exitCode = 1;
        } catch (error) { state.cleanup.push({kind: 'product', id: entry.id, error: error.message}); process.exitCode = 1; }
    }
    for (const entry of state.lists) {
        const actor = state.accounts.find(a => a.label === entry.actor);
        try {
            // Omit force: use WordPress trash instead of permanent deletion.
            const result = await api('/wp/v2/shopping-list/' + entry.id, actor, 'DELETE');
            state.cleanup.push({kind: 'list', id: entry.id, status: result.status, trashed: result.data.status === 'trash'});
            if (result.status !== 200 || result.data.status !== 'trash') process.exitCode = 1;
        } catch (error) { state.cleanup.push({kind: 'list', id: entry.id, error: error.message}); process.exitCode = 1; }
    }
    // Keep empty guest accounts for an auditable test record; never call user deletion.
    if (state.cleanup.every(item => item.status === 200 && (item.kind !== 'list' || item.trashed))) {
        for (const account of state.accounts) delete account.token;
    }
    await save();
    console.log(JSON.stringify({passedChecks: state.checks.length, failed: Boolean(state.failure), cleanup: state.cleanup, report: statePath}));
}
