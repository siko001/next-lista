import {findMatchingListProduct} from "./ingredientIdentity.mjs";
import {assistantHttpError} from "./assistantJobErrors.mjs";
import {createAssistantAddQueue} from "./assistantAddQueue.mjs";
import {WP_API_BASE, getAllProducts, decodeHtmlEntities} from "./helpers";
import {invalidateListData, invalidateCache, cacheKeys} from "./dataCache.mjs";

const request = async (path, token, body) => {
    const response = await fetch(`${WP_API_BASE}/custom/v1/${path}`, {
        method: body ? "POST" : "GET",
        headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`},
        cache: "no-store",
        ...(body ? {body: JSON.stringify(body)} : {}),
    });
    if (!response.ok) throw assistantHttpError(response.status, response.status === 401 || response.status === 403
        ? "Please sign in again, then retry this job."
        : "Could not save your items. Check your connection and retry this job.");
    return response.json();
};

const queue = createAssistantAddQueue({
    storage: () => window.localStorage,
    isOnline: () => navigator.onLine !== false,
    // Serializes jobs across tabs and releases automatically when a tab refreshes.
    withLock: (name, run) => navigator.locks ? navigator.locks.request(name, run) : run(),
    findExistingProduct: async (listId, title, {token}) => {
        const list = await request(`get-shopping-list-products?shoppingListId=${encodeURIComponent(listId)}`, token);
        if (!list?.success || !Array.isArray(list.linkedProducts)) {
            throw new Error("Could not check the items already on this list. Please retry this job.");
        }
        const products = [...list.linkedProducts, ...(list.checkedProducts || []), ...(list.baggedProducts || [])]
            .map((product) => ({...product, title: decodeHtmlEntities(product.title)}));
        return findMatchingListProduct(products, title);
    },
    resolveProduct: async (title, {token, userId}) => {
        const normal = (value) => decodeHtmlEntities(typeof value === "string" ? value : value?.rendered || "").toLowerCase().trim();
        const catalogue = await getAllProducts(token, {strict: true});
        const core = catalogue.find((product) => normal(product.title) === normal(title));
        if (core?.id) return core.id;
        // Always read fresh: creation might have succeeded just before a refresh,
        // even if its response and local checkpoint never reached the old page.
        const custom = await request("get-custom-products", token);
        if (!Array.isArray(custom)) throw new Error("Could not check existing products. Please retry this job.");
        const existing = custom.find((product) => normal(product.title) === normal(title));
        if (existing?.id) return existing.id;
        const created = await request("create-custom-product", token, {title});
        const id = created?.id || created?.product_id || created?.product?.id;
        if (!id) throw new Error(`Could not create ${title}. Please retry this job.`);
        invalidateCache(cacheKeys.customProducts(userId));
        return id;
    },
    addProduct: async (shoppingListId, productId, {token}) => {
        // WordPress's add operation is idempotent for a given list/product pair.
        await request("update-shopping-list", token, {shoppingListId, productId, action: "add"});
    },
    onAdded: (job, product) => {
        invalidateListData(job.userId);
        window.dispatchEvent(new CustomEvent("lista:items-added", {
            detail: {listId: job.listId, items: [{id: product.productId, title: product.title}]},
        }));
    },
    onActivity: (running) => window.dispatchEvent(new CustomEvent(`lista:ai-adding-${running ? "start" : "end"}`)),
});

export const getAssistantAddJobs = queue.getSnapshot;
export const subscribeAssistantAddJobs = queue.subscribe;
export const dismissAssistantAddJob = queue.dismiss;
export const retryAssistantAddJob = queue.retry;
export const setAssistantAddSession = queue.setSession;
export const syncAssistantAddJobs = queue.sync;
export const runAssistantAddJob = queue.enqueue;
