import test from "node:test";
import assert from "node:assert/strict";
import {internalPath, incomingLink, hostedApiUrl} from "../src/urls.mjs";
const site = "https://next-lista.vercel.app";
test("verified invite and reset links retain their query parameters", () => {
    assert.equal(incomingLink(`${site}/shared-list/42?k=abc%2Bdef`, site), "/shared-list/42?k=abc%2Bdef");
    assert.equal(incomingLink(`${site}/reset-password?key=k&login=neil`, site), "/reset-password?key=k&login=neil");
    for (const value of ["https://evil.test/shared-list/42?k=x", `${site}/api/ai/recipes`, `${site}.evil.test/list/42`, "javascript:alert(1)"]) assert.equal(incomingLink(value, site), null);
});
test("external and protocol-relative URLs cannot become local app navigation", () => {
    assert.equal(internalPath("/list/42", site, "https://localhost"), "/list/42");
    assert.equal(internalPath(`${site}/list/42`, site, "https://localhost"), "/list/42");
    for (const value of ["//evil.test", "/\\evil.test", "https://evil.test", "javascript:alert(1)"]) assert.equal(internalPath(value, site, "https://localhost"), null);
    for (const value of ["javascript:alert(1)", "data:text/html,test", "custom:javascript:alert(1)", "capacitor://evil.test/list/42"]) assert.equal(internalPath(value, site, "null"), null);
    assert.equal(internalPath("capacitor://localhost/list/42", site, "null"), "/list/42");
});
test("AI requests go to the hosted Next server, retaining encoded link-preview queries", () => {
    assert.equal(hostedApiUrl("/api/ai/voice-items", site), `${site}/api/ai/voice-items`);
    assert.equal(hostedApiUrl("/api/ai/link-preview?url=https%3A%2F%2Fexample.com", site), `${site}/api/ai/link-preview?url=https%3A%2F%2Fexample.com`);
    assert.throws(() => hostedApiUrl("//evil.test", site));
    assert.throws(() => hostedApiUrl("/api/../../private", site));
});
