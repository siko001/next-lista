import test from "node:test";
import assert from "node:assert/strict";
import {getTranslation, rememberTranslation, searchProductsInLanguage} from "../app/lib/domTranslations.mjs";

test("searches English and only the selected translated language", () => {
    const products = [{id: 901001, title: "Flour"}, {id: 901002, title: "Milk"}];
    rememberTranslation("mt", "product:901001", "Flour", "Dqiq");
    rememberTranslation("it", "product:901001", "Flour", "Farina");

    assert.deepEqual(searchProductsInLanguage(products, "flour", "mt"), [products[0]]);
    assert.deepEqual(searchProductsInLanguage(products, "dqiq", "mt"), [products[0]]);
    assert.deepEqual(searchProductsInLanguage(products, "farina", "mt"), []);
    assert.deepEqual(searchProductsInLanguage(products, "farina", "it"), [products[0]]);
    assert.deepEqual(searchProductsInLanguage(products, "dqiq", "en"), []);
});

test("does not save the previous language while Google switches the page", () => {
    rememberTranslation("mt", "product:901003", "Bread", "Ħobż");
    assert.equal(rememberTranslation("it", "product:901003", "Bread", "Ħobż"), false);
    assert.equal(getTranslation("it", "product:901003"), null);
});
