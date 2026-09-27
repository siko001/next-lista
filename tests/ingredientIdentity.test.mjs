import test from "node:test";
import assert from "node:assert/strict";
import {ingredientIdentity, findMatchingListProduct} from "../app/lib/ingredientIdentity.mjs";
import {createAssistantAddQueue} from "../app/lib/assistantAddQueue.mjs";

const original = [
    "1 can chickpeas, drained", "200g halloumi, sliced", "2 tbsp olive oil",
    "1 tbsp lemon juice", "½ cucumber, diced", "10 cherry tomatoes, halved",
    "¼ red onion, thinly sliced", "8 Kal olives, pitted & sliced",
    "2 tbsp fresh parsley, chopped", "Salt & pepper to taste",
];
const withPita = [
    "1 can chickpeas, drained", "200g halloumi, sliced", "1 cucumber, diced",
    "1 cup cherry tomatoes, halved", "¼ red onion, thinly sliced",
    "½ cup Kalamata olives, pitted", "2 tbsp olive oil", "2 tbsp lemon juice",
    "2 tbsp fresh parsley, chopped", "Salt and pepper to taste", "2 pita breads",
];

test("the screenshot's extended recipe matches all ten original ingredients", () => {
    const existing = original.map((title, index) => ({id: index + 1, title}));
    for (const title of withPita.slice(0, -1)) {
        assert.ok(findMatchingListProduct(existing, title), `did not match ${title}`);
    }
    assert.equal(findMatchingListProduct(existing, withPita.at(-1)), null);
});

test("quantity, measurement and simple preparation differences match", () => {
    for (const [left, right] of [
        ["1/2 cucumber, diced", "2 cucumbers, sliced"],
        ["1½ cups chickpeas, drained", "2 cans chickpeas, rinsed"],
        ["200g halloumi, sliced", "300 g halloumi"],
        ["1 tablespoon lemon juice", "2 tbsp lemon juice"],
        ["Salt &amp; pepper to taste", "salt and pepper"],
        ["1 red onion, finely chopped", "¼ red onion, thinly sliced"],
    ]) assert.equal(ingredientIdentity(left), ingredientIdentity(right), `${left} vs ${right}`);
});

test("distinct varieties, dietary modifiers, and preparations that define a product stay separate", () => {
    for (const [left, right] of [
        ["1 red onion", "1 white onion"], ["Chicken breast", "Chicken thigh"],
        ["1 cup soy milk", "1 cup milk"], ["2% milk", "1% milk"],
        ["1 tbsp fresh parsley", "1 tbsp dried parsley"],
        ["1 tbsp olive oil", "1 tbsp sesame oil"], ["tomatoes", "cherry tomatoes"],
        ["1 tsp salt", "Salt and pepper"], ["salted butter", "unsalted butter"],
        ["1 cup crushed tomatoes", "1 cup whole tomatoes"],
    ]) assert.notEqual(ingredientIdentity(left), ingredientIdentity(right), `${left} vs ${right}`);
});

test("an extended recipe creates only pita and leaves the existing ingredient quantities intact", async () => {
    const values = new Map();
    const store = {
        get length() { return values.size; }, key: (index) => [...values.keys()][index],
        getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
    };
    const lists = new Map([[99, original.map((title, index) => ({id: index + 1, title}))], [100, []]]);
    const created = [];
    const addedEvents = [];
    const queue = createAssistantAddQueue({
        storage: () => store, withLock: (_name, run) => run(),
        findExistingProduct: async (listId, title) => findMatchingListProduct(lists.get(listId), title),
        resolveProduct: async (title) => { created.push(title); return 100 + created.length; },
        addProduct: async (listId, id) => { lists.get(listId).push({id, title: created.at(-1)}); },
        onAdded: (_job, item) => addedEvents.push(item.title),
    });
    queue.setSession({userId: 7, token: "test"});
    const result = await queue.enqueue({userId: 7, listId: 99, items: withPita});
    assert.deepEqual(result, {done: 11, total: 11, skipped: 10});
    assert.deepEqual(created, ["2 pita breads"]);
    assert.deepEqual(addedEvents, ["2 pita breads"]);
    assert.deepEqual(lists.get(99).slice(0, 10).map((item) => item.title), original);
    // Matching is scoped to the target list, not the global product catalogue.
    await queue.enqueue({userId: 7, listId: 100, items: ["1 cucumber, diced"]});
    assert.equal(lists.get(100).length, 1);
});
