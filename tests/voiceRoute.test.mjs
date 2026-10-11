import test, {afterEach, beforeEach} from "node:test";
import assert from "node:assert/strict";
import {POST} from "../app/api/ai/voice-items/route.js";

const savedFetch = globalThis.fetch;
const savedEnv = {...process.env};
beforeEach(() => {
    process.env.GROQ_API_KEY = "test-only-key";
    process.env.NEXT_PUBLIC_WORDPRESS_URL = "https://wordpress.example.test";
});
afterEach(() => {
    globalThis.fetch = savedFetch;
    for (const key of ["GROQ_API_KEY", "NEXT_PUBLIC_WORDPRESS_URL"]) {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
    }
});
function request(auth = true) {
    const body = new FormData();
    body.set("audio", new File(["mock audio"], "voice.webm", {type: "audio/webm"}));
    return new Request("https://lista.example.test/api/ai/voice-items", {
        method: "POST", headers: auth ? {Authorization: "Bearer test-session"} : {}, body,
    });
}
test("anonymous voice input never calls WordPress or a paid provider", async () => {
    globalThis.fetch = () => { throw Error("Must not fetch"); };
    assert.equal((await POST(request(false))).status, 401);
});
for (const [status, data, expected] of [[429, {}, 429], [403, {}, 401], [500, {}, 503], [200, {id: 0}, 503]]) {
    test(`voice fails closed for quota response ${status}/${JSON.stringify(data)}`, async () => {
        let calls = 0;
        globalThis.fetch = async (url, options) => {
            calls++;
            assert.equal(url, "https://wordpress.example.test/wp-json/custom/v1/assistant-quota");
            assert.equal(options.method, "POST");
            assert.equal(options.headers.Authorization, "Bearer test-session");
            return Response.json(data, {status});
        };
        assert.equal((await POST(request())).status, expected);
        assert.equal(calls, 1);
    });
}
test("authorized voice transcribes and extracts items after consuming quota", async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
        calls.push(url);
        if (calls.length === 1) return Response.json({id: 7});
        if (calls.length === 2) return Response.json({text: "milk, bread"});
        return Response.json({choices: [{message: {content: '{"items":["milk","bread"]}'}}]});
    };
    const result = await POST(request());
    assert.equal(result.status, 200);
    assert.deepEqual((await result.json()).items, ["milk", "bread"]);
    assert.equal(calls.length, 3);
    assert.ok(calls[0].endsWith("/assistant-quota"));
});
