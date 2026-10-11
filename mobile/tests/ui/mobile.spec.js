import {test, expect} from "@playwright/test";
import CryptoJS from "crypto-js";
import {mkdir} from "node:fs/promises";

const jwt = "test.payload.signature";
const encrypted = CryptoJS.AES.encrypt(JSON.stringify(jwt), "your-secret-key-123").toString();
const product = (id, title) => ({id, ID: id, title, category: "Other", categories: []});

async function fixture(page, {registered = true} = {}) {
    const state = {
        registered, checked: [product(11, "Milk"), product(12, "Tomatoes"), product(13, "Pasta")], bagged: [],
        name: "Weekly groceries", order: 0, extraLists: [], requests: [], sockets: [], errors: [],
    };
    page.on("pageerror", (error) => state.errors.push(error.message));
    await page.addInitScript(({encrypted, registered}) => {
        if (!sessionStorage.getItem("test-initialized")) {
            sessionStorage.setItem("test-initialized", "yes");
            sessionStorage.setItem("lista-session-v1", JSON.stringify(Object.fromEntries(Object.entries({
                token: encrypted, id: "7", registered: registered ? "yes" : "no", username: '{"userName":"Neil"}',
            }).map(([key, value]) => [key, {value, expires: null}]))));
        }
        localStorage.setItem("theme", "light");
    }, {encrypted, registered});
    const list = () => ({id: 101, title: state.name, menu_order: state.order, acf: {
        owner_id: "7", owner_name: "Neil", linked_products: [...state.checked, ...state.bagged],
        product_count: state.checked.length + state.bagged.length, bagged_product_count: state.bagged.length,
        shared_with_users: [{ID: 8, display_name: "Alex"}],
    }});
    await page.route("**/wp-json/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        state.requests.push({path: url.pathname, method: request.method(), body: request.postData()});
        let body;
        if (request.method() === "OPTIONS") return route.fulfill({status: 204, headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS"}});
        if (url.pathname.endsWith("/user-data")) body = {id: 7, name: "Neil", email: "neil@example.com", registered: state.registered ? "yes" : "no"};
        else if (url.pathname.includes("shopping-lists-by-owner")) body = [list(), ...state.extraLists];
        else if (url.pathname.endsWith("/shopping-list") && request.method() === "POST") {
            const {title, menu_order, acf} = request.postDataJSON();
            const created = {id: 102 + state.extraLists.length, title, menu_order, acf: {...acf, product_count: 0, shared_with_users: []}};
            state.extraLists.push(created);
            state.broadcastChange?.();
            body = {...created, title: {raw: title, rendered: title}};
        }
        else if (url.pathname.endsWith("/shopping-list/order") && request.method() === "POST") {
            for (const {id, menu_order} of request.postDataJSON().orders) {
                if (id === 101) state.order = menu_order;
                else state.extraLists.find(list => list.id === id).menu_order = menu_order;
            }
            state.broadcastChange?.();
            body = {success: true};
        }
        else if (url.pathname.endsWith("/shopping-list/101")) {
            if (request.method() === "POST") {
                if (state.failRename) return route.fulfill({status: 500, json: {message: "Rename failed"}, headers: {"Access-Control-Allow-Origin": "*"}});
                state.name = request.postDataJSON().title;
                state.broadcastRename?.();
            }
            body = list();
        }
        else if (url.pathname.endsWith("/get-shopping-list-products")) body = {success: true, linkedProducts: [...state.checked, ...state.bagged], checkedProducts: state.checked, baggedProducts: state.bagged};
        else if (url.pathname.endsWith("/products")) body = [product(11, "Milk"), product(12, "Tomatoes"), product(13, "Pasta"), product(14, "Bread")];
        else if (/get-custom-products|get-favourites/.test(url.pathname)) body = [];
        else if (url.pathname.endsWith("/generate-share-code")) body = {success: true, code: "invite-123"};
        else if (url.pathname.includes("/shared-list/") || url.pathname.endsWith("/accept-shared-list")) body = {success: true};
        else if (url.pathname.endsWith("/update-shopping-list")) {
            const {action, productId} = request.postDataJSON();
            if (action === "bag") { const found = state.checked.find((item) => item.id === productId); state.checked = state.checked.filter((item) => item.id !== productId); if (found) state.bagged.push(found); }
            if (action === "unbag") { const found = state.bagged.find((item) => item.id === productId); state.bagged = state.bagged.filter((item) => item.id !== productId); if (found) state.checked.push(found); }
            state.broadcastUpdate?.();
            body = {success: true};
        } else if (url.pathname.endsWith("/jwt-auth/v1/token")) {
            state.registered = true;
            body = {token: jwt, user_id: 7, user_display_name: "Neil"};
        } else if (/claim|transfer/.test(url.pathname)) body = {success: true};
        else if (url.pathname.endsWith("/create-user")) body = {user_id: 7, username: "guest-test", name: "Guest"};
        else body = {success: true};
        await route.fulfill({json: body, headers: {"Access-Control-Allow-Origin": "*"}});
    });
    await page.route("https://translate.google.com/**", (route) => route.abort());
    await page.routeWebSocket(/pusher\.com/, (socket) => {
        state.sockets.push(socket);
        socket.send(JSON.stringify({event: "pusher:connection_established", data: JSON.stringify({socket_id: "123.456", activity_timeout: 120})}));
        socket.onMessage((raw) => {
            const message = JSON.parse(raw);
            if (message.event === "pusher:subscribe") socket.send(JSON.stringify({event: "pusher_internal:subscription_succeeded", channel: message.data.channel, data: "{}"}));
            if (message.event === "pusher:ping") socket.send(JSON.stringify({event: "pusher:pong", data: "{}"}));
        });
    });
    return state;
}

test("phone layout opens existing lists, bags items and preserves changes on navigation", async ({page}) => {
    const state = await fixture(page);
    await page.goto("/");
    await expect(page.getByRole("button", {name: "Weekly groceries", exact: true})).toBeVisible();
    await mkdir("artifacts", {recursive: true});
    await page.screenshot({path: "artifacts/android-home.png"});
    await page.locator(".list-card-count").first().click();
    await expect(page).toHaveURL(/\/list\/101$/);
    await expect(page.getByRole("button", {name: "Bag Milk", exact: true})).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 412);
    await expect(page.locator(".list-product-row").last()).toHaveCSS("opacity", "1");
    await expect(page.getByRole("button", {name: "Add Products", exact: true})).toBeInViewport({ratio: 1});
    await page.screenshot({path: "artifacts/android-list.png"});
    await page.getByRole("button", {name: "Bag Milk", exact: true}).click();
    await expect(page.getByRole("button", {name: "Move Milk back to checklist"})).toBeVisible();
    expect(state.requests.some((request) => request.method === "POST" && request.body.includes('"action":"bag"'))).toBeTruthy();
    await page.locator("#site-logo").click();
    await expect(page.locator(".list-card-count").first()).toContainText("1 / 3");
    await page.locator(".list-card-count").first().click();
    await expect(page.getByRole("button", {name: "Move Milk back to checklist"})).toBeVisible();
    expect(state.errors).toEqual([]);
});

test("a share deep link retains its invite code and uses the existing acceptance API", async ({page}) => {
    const state = await fixture(page);
    await page.goto("/shared-list/101?k=invite-123");
    await expect(page).toHaveURL("http://127.0.0.1:4173/");
    const accepted = state.requests.find((request) => request.path.endsWith("/accept-shared-list"));
    expect(JSON.parse(accepted.body)).toMatchObject({list_id: "101", user_id: 7, code: "invite-123"});
    expect(state.errors).toEqual([]);
});

test("returning online fetches authoritative data that changed while disconnected", async ({page}) => {
    const state = await fixture(page);
    await page.goto("/list/101");
    await expect(page.getByRole("button", {name: "Bag Milk", exact: true})).toBeVisible();
    state.checked.push(product(15, "Coffee"));
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByRole("button", {name: "Bag Coffee", exact: true})).toBeVisible();
    expect(state.errors).toEqual([]);
});

test("bagging and unbagging synchronize between separate devices signed into the same account", async ({page, browser}) => {
    const otherContext = await browser.newContext();
    try {
        const otherPage = await otherContext.newPage();
        const first = await fixture(page);
        const second = await fixture(otherPage);
        const broadcast = (source, destination) => () => {
            destination.checked = [...source.checked];
            destination.bagged = [...source.bagged];
            for (const socket of [...source.sockets, ...destination.sockets]) socket.send(JSON.stringify({
                event: "list-updated", channel: "shopping-list-101",
                data: JSON.stringify({sender_id: 7, list_id: 101, message: "Other user updated the list", fields: {
                    linked_products: [...source.checked, ...source.bagged],
                    checked_products: source.checked, bagged_linked_products: source.bagged,
                    product_count: source.checked.length + source.bagged.length,
                    bagged_product_count: source.bagged.length,
                }}),
            }));
        };
        first.broadcastUpdate = broadcast(first, second);
        second.broadcastUpdate = broadcast(second, first);
        await Promise.all([page.goto("/list/101"), otherPage.goto("/list/101")]);
        await expect(page.getByRole("button", {name: "Bag Milk", exact: true})).toBeVisible();
        await expect(otherPage.getByRole("button", {name: "Bag Milk", exact: true})).toBeVisible();
        await expect.poll(() => first.sockets.length > 0 && second.sockets.length > 0).toBeTruthy();
        await page.getByRole("button", {name: "Bag Milk", exact: true}).click();
        await expect(otherPage.getByRole("button", {name: "Move Milk back to checklist"})).toBeVisible();
        await otherPage.getByRole("button", {name: "Move Milk back to checklist"}).click();
        await expect(page.getByRole("button", {name: "Bag Milk", exact: true})).toBeVisible();
        await expect(page.getByText("Other user updated the list", {exact: true})).toHaveCount(0);
        expect([...first.errors, ...second.errors]).toEqual([]);
    } finally {
        await otherContext.close();
    }
});

test("remote creation, rename, deletion and newly shared lists appear without refreshing", async ({page}) => {
    const state = await fixture(page);
    await page.goto("/");
    await expect(page.getByRole("button", {name: "Weekly groceries", exact: true})).toBeVisible();
    await expect.poll(() => state.sockets.length).toBeGreaterThan(0);
    const emit = (channel, event, data) => {
        for (const socket of state.sockets) socket.send(JSON.stringify({channel, event, data: JSON.stringify(data)}));
    };
    state.extraLists.push({id: 102, title: "Created on my phone", menu_order: -1, acf: {owner_id: "7", product_count: 0, shared_with_users: []}});
    emit("user-lists-7", "list-summary-updated", {list_id: 102, title: "Created on my phone", sender_id: 7});
    await expect(page.getByRole("button", {name: "Created on my phone", exact: true})).toBeVisible();
    state.extraLists[0].title = "Renamed on my phone";
    emit("user-lists-7", "list-summary-updated", {list_id: 102, title: "Renamed on my phone", sender_id: 7});
    await expect(page.getByRole("button", {name: "Renamed on my phone", exact: true})).toBeVisible();
    state.extraLists = [];
    emit("shopping-list-102", "list-deleted", {list_id: 102, sender_id: 7});
    await expect(page.getByRole("button", {name: "Renamed on my phone", exact: true})).toHaveCount(0);
    state.extraLists.push({id: 103, title: "Shared from another device", menu_order: -1, acf: {owner_id: "8", product_count: 0, shared_with_users: [{ID: 7, display_name: "Neil"}]}});
    emit("user-lists-7", "share-update", {action: "add", listId: 103, userId: 7, userName: "Neil", actorId: 8});
    await expect(page.getByRole("button", {name: "Shared from another device", exact: true})).toBeVisible();
    state.extraLists = [];
    emit("user-lists-7", "share-update", {action: "remove", listId: 103, userId: 7, userName: "Neil", actorId: 8});
    await expect(page.getByRole("button", {name: "Shared from another device", exact: true})).toHaveCount(0);
    expect(state.errors).toEqual([]);
});

test("creating and reordering lists synchronize in both directions while both screens stay open", async ({page, browser}) => {
    test.setTimeout(60000);
    const otherContext = await browser.newContext();
    try {
        const otherPage = await otherContext.newPage();
        const first = await fixture(page);
        const second = await fixture(otherPage);
        const broadcast = (source, destination) => () => {
            destination.order = source.order;
            destination.extraLists = structuredClone(source.extraLists);
            for (const socket of [...source.sockets, ...destination.sockets]) socket.send(JSON.stringify({
                event: "lists-changed", channel: "user-lists-7", data: JSON.stringify({event_id: crypto.randomUUID()}),
            }));
        };
        first.broadcastChange = broadcast(first, second);
        second.broadcastChange = broadcast(second, first);
        await Promise.all([page.goto("/"), otherPage.goto("/")]);
        await expect(page.locator(".list-card-title")).toHaveText(["Weekly groceries"]);
        await expect(otherPage.locator(".list-card-title")).toHaveText(["Weekly groceries"]);
        const create = async (p, title) => {
            await p.getByRole("button", {name: /^create list$/i}).click();
            await p.getByPlaceholder("e.g. Weekly groceries").fill(title);
            await p.getByRole("button", {name: /^create list$/i}).last().click();
            await expect(page.getByRole("button", {name: title, exact: true})).toBeVisible();
            await expect(otherPage.getByRole("button", {name: title, exact: true})).toBeVisible();
        };
        await create(page, "Created on the app");
        await create(otherPage, "Created on the browser");
        const reorder = async (p, title, mouse = false) => {
            const handle = p.getByRole("button", {name: `Drag ${title} to reorder`, exact: true});
            const saved = p.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/shopping-list/order"));
            if (mouse) {
                const start = await handle.boundingBox();
                const next = await p.locator(".home-list-slot").nth(1).boundingBox();
                await handle.hover();
                await p.mouse.down();
                await p.mouse.move(start.x + start.width / 2, next.y + next.height / 2, {steps: 12});
                await p.mouse.up();
            } else {
                await handle.focus();
                await handle.press("Space");
                await handle.press("ArrowDown");
                await handle.press("Space");
            }
            await saved;
        };
        await reorder(page, "Created on the browser");
        const titles = ["Created on the app", "Created on the browser", "Weekly groceries"];
        await expect(otherPage.locator(".list-card-title")).toHaveText(titles);
        await reorder(otherPage, "Created on the app", true);
        await expect(page.locator(".list-card-title")).toHaveText([titles[1], titles[0], titles[2]]);
        expect([...first.errors, ...second.errors]).toEqual([]);
    } finally { await otherContext.close(); }
});

test("account change events refresh the title and products of an open list", async ({page}) => {
    const state = await fixture(page);
    await page.goto("/list/101");
    await expect(page.getByRole("button", {name: "Bag Milk", exact: true})).toBeVisible();
    await expect.poll(() => state.sockets.length).toBeGreaterThan(0);
    state.name = "Changed on another device";
    state.bagged.push(state.checked.shift());
    for (const socket of state.sockets) socket.send(JSON.stringify({
        event: "lists-changed", channel: "user-lists-7", data: '{"event_id":"remote-change"}',
    }));
    await expect(page.locator(".list-header-title-group h2")).toHaveText(state.name);
    await expect(page.getByRole("button", {name: "Move Milk back to checklist"})).toBeVisible();
    expect(state.errors).toEqual([]);
});

test("an open list accepts later remote renames after being renamed locally", async ({page, browser}) => {
    const otherContext = await browser.newContext();
    try {
        const otherPage = await otherContext.newPage();
        const first = await fixture(page);
        const second = await fixture(otherPage);
        const broadcast = (source, destination) => () => {
            destination.name = source.name;
            for (const socket of [...source.sockets, ...destination.sockets]) socket.send(JSON.stringify({
                event: "list-summary-updated", channel: "user-lists-7",
                data: JSON.stringify({list_id: 101, sender_id: 7, title: source.name}),
            }));
        };
        first.broadcastRename = broadcast(first, second);
        second.broadcastRename = broadcast(second, first);
        await Promise.all([page.goto("/list/101"), otherPage.goto("/list/101")]);
        const heading = p => p.locator(".list-header-title-group h2");
        await expect(heading(page)).toHaveText("Weekly groceries");
        await expect(heading(otherPage)).toHaveText("Weekly groceries");
        await expect.poll(() => first.sockets.length > 0 && second.sockets.length > 0).toBeTruthy();
        const rename = async (p, title) => {
            await heading(p).click();
            await p.getByPlaceholder("List-A Name").fill(title);
            await p.getByPlaceholder("List-A Name").press("Enter");
            await expect(heading(page)).toHaveText(title);
            await expect(heading(otherPage)).toHaveText(title);
        };
        await rename(page, "Renamed on the app");
        await rename(otherPage, "Renamed on the browser");
        await rename(page, "Renamed on the app again");
        // Both clients have now edited locally. A third client must still win.
        first.name = second.name = "Renamed on a third device";
        first.broadcastRename();
        await expect(heading(page)).toHaveText(first.name);
        await expect(heading(otherPage)).toHaveText(first.name);
        await page.locator("#site-logo").click();
        await expect(page.getByRole("button", {name: first.name, exact: true})).toBeVisible();
        await page.locator(".list-card-count").first().click();
        await expect(heading(page)).toHaveText(first.name);
        expect([...first.errors, ...second.errors]).toEqual([]);
    } finally { await otherContext.close(); }
});

test("a failed rename restores the open list title", async ({page}) => {
    const state = await fixture(page);
    state.failRename = true;
    await page.goto("/list/101");
    const heading = page.locator(".list-header-title-group h2");
    await expect(heading).toHaveText("Weekly groceries");
    await heading.click();
    await page.getByPlaceholder("List-A Name").fill("An unsaved name");
    await page.getByPlaceholder("List-A Name").press("Enter");
    await expect.poll(() => state.requests.some(r => r.method === "POST" && r.path.endsWith("/shopping-list/101"))).toBeTruthy();
    await expect(heading).toHaveText("Weekly groceries");
    expect(state.errors).toEqual([]);
});

test("password recovery and login screens retain the existing mobile design", async ({page}) => {
    const state = await fixture(page, {registered: false});
    await page.goto("/login");
    await expect(page.getByLabel("Email address", {exact: true})).toBeVisible();
    await page.getByRole("link", {name: "Forgot your password?"}).click();
    await expect(page).toHaveURL(/\/password-reset$/);
    await expect(page.getByLabel("Email address", {exact: true})).toBeVisible();
    await page.goto("/reset-password?key=test&login=neil");
    await expect(page.getByLabel("New password", {exact: true})).toBeVisible();
    expect(state.errors).toEqual([]);
});

test("AI requests use the hosted route adapter and the assistant remains usable", async ({page}) => {
    const state = await fixture(page);
    await page.route("**/api/ai/recipes", (route) => route.fulfill({json: {reply: "Try a fresh tomato pasta for dinner."}}));
    await page.goto("/list/101");
    await expect(page.getByRole("button", {name: "Bag Milk", exact: true})).toBeVisible();
    await page.locator("button.chat-widget").click();
    await page.getByPlaceholder("Ask anything about meals or your list...").fill("What can I cook for dinner?");
    const request = page.waitForRequest((request) => request.url().includes("/api/ai/recipes"));
    await page.getByRole("button", {name: "Send", exact: true}).click();
    expect((await request).method()).toBe("POST");
    await page.screenshot({path: "artifacts/android-assistant.png"});
    expect(state.errors).toEqual([]);
});

test("login transfers guest lists before replacing the mobile session and survives a reload", async ({page}) => {
    test.setTimeout(45000);
    const state = await fixture(page, {registered: false});
    await page.goto("/login");
    await page.getByLabel("Email address", {exact: true}).fill("neil@example.com");
    await page.getByLabel("Password", {exact: true}).fill("testing123");
    await page.getByRole("button", {name: "Log in", exact: true}).click();
    // Login deliberately shows its confirmation for two seconds before a full
    // document navigation, which also has to load the development bundle.
    await expect(page).toHaveURL("http://127.0.0.1:4173/", {timeout: 15000});
    await expect(page.getByRole("link", {name: "Logout", exact: true})).toBeVisible();
    expect(state.requests.some((request) => request.path.endsWith("/claim-guest-lists"))).toBeTruthy();
    await page.reload();
    await expect(page.getByRole("button", {name: "Weekly groceries", exact: true})).toBeVisible();
    const persisted = await page.evaluate(() => JSON.parse(sessionStorage.getItem("lista-session-v1")));
    expect(persisted.registered.value).toBe("yes");
    expect(state.errors).toEqual([]);
});

test("copied invitations use the public website origin rather than the local mobile origin", async ({page}) => {
    const state = await fixture(page);
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", {
        configurable: true, value: {writeText: async (text) => { window.copiedInvitation = text; }},
    }));
    await page.goto("/list/101");
    await expect(page.getByRole("button", {name: "Bag Milk", exact: true})).toBeVisible();
    await page.locator(".shopping-list-header-settings > .settings-icon").click();
    await page.getByRole("button", {name: "Share", exact: true}).click();
    await page.getByRole("button", {name: "Copy link Paste it wherever you like"}).click();
    await expect.poll(() => page.evaluate(() => window.copiedInvitation)).toBe("https://next-lista.vercel.app/shared-list/101?k=invite-123");
    expect(state.errors).toEqual([]);
});
