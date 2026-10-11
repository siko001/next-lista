import test from "node:test";
import assert from "node:assert/strict";
import {clearAssistantHistory, deletionEmailUrl, isPublicInfoPath, SUPPORT_EMAIL} from "../../app/lib/privacy.mjs";

test("deletion email provides instructions without embedding session credentials", () => {
    const url = new URL(deletionEmailUrl);
    assert.equal(url.pathname, SUPPORT_EMAIL);
    assert.match(url.searchParams.get("subject"), /account and data deletion/);
    assert.match(url.searchParams.get("body"), /verify ownership/);
    assert.match(url.searchParams.get("body"), /do not include passwords/i);
});

test("clearing assistant data removes all histories while preserving unrelated preferences and auth", () => {
    const values = new Map([["lista:assistant:7:home:home", "draft"], ["lista:assistant:7:home:home:history", "history"], ["lista:assistant:8:list:1:voice", "voice"], ["theme", "dark"], ["lista-session-v1", "session"]]);
    const storage = {get length() { return values.size; }, key: index => [...values.keys()][index], removeItem: key => values.delete(key)};
    clearAssistantHistory(storage);
    assert.deepEqual([...values.keys()], ["theme", "lista-session-v1"]);
    assert.equal(isPublicInfoPath("/delete-account/"), true);
    assert.equal(isPublicInfoPath("/privacy"), true);
    assert.equal(isPublicInfoPath("/list/1"), false);
});
