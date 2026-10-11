import test, {beforeEach, afterEach} from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/ai/recipes/route.js";

const originalFetch = globalThis.fetch;
const originalGroqKey = process.env.GROQ_API_KEY;
const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalWordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL;
const wordpressUrl = "https://wordpress.example.test";
const sessionUrl = `${wordpressUrl}/wp-json/custom/v1/assistant-quota`;
const authHeaders = {Authorization: "Bearer guest-or-registered-token"};

beforeEach(() => { process.env.NEXT_PUBLIC_WORDPRESS_URL = wordpressUrl; });
afterEach(restore);

function validSession(url, options) {
  if (url !== sessionUrl) return null;
  assert.equal(options.headers.Authorization, authHeaders.Authorization);
  assert.equal(options.cache, "no-store");
  assert.equal(options.redirect, "error");
  return Response.json({id: 7, registered: "no"});
}

function restore() {
  if (originalWordpressUrl === undefined) delete process.env.NEXT_PUBLIC_WORDPRESS_URL;
  else process.env.NEXT_PUBLIC_WORDPRESS_URL = originalWordpressUrl;
  globalThis.fetch = originalFetch;
  if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
  if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAIKey;
}

test("a natural main and side request returns a usable recipe", async () => {
  process.env.GROQ_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;
  let sent;
  globalThis.fetch = async (_url, options) => {
    const session = validSession(_url, options);
    if (session) return session;
    sent = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      kind: "recipe",
      message: "That combination sounds great. Start with the marinade.",
      title: "Chicken tandoori masala with cardamom rice",
      ingredients: ["Chicken thighs", "Yogurt", "Garam masala", "Basmati rice", "Cardamom", "Cumin"],
      steps: ["Marinate and roast the chicken.", "Steam the rice with cardamom and finish with toasted cumin."],
      suggestions: [],
      links: [],
    }) } }] });
  };
  try {
    const query = "i wanna make chicken tandoori masala with side of cardomom steamed rice toasted cumin";
    const response = await POST(new Request("http://localhost/api/ai/recipes", {
      method: "POST", headers: authHeaders, body: JSON.stringify({ query }),
    }));
    assert.equal(response.status, 200);
    const reply = await response.json();
    assert.equal(reply.kind, "recipe");
    assert.equal(reply.ingredients.length, 6);
    assert.equal(reply.steps.length, 2);
    assert.equal(sent.messages.at(-1).content, query);
    assert.equal(sent.model, "openai/gpt-oss-120b");
  } finally { restore(); }
});

test("recommendations preserve conversation context", async () => {
  process.env.GROQ_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;
  let sent;
  globalThis.fetch = async (_url, options) => {
    const session = validSession(_url, options);
    if (session) return session;
    sent = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      kind: "chat", message: "Try a chickpea and feta salad or a warm grain bowl.",
      title: "", ingredients: [], steps: [],
      suggestions: ["Chickpea and feta salad", "Warm grain bowl"], links: [],
    }) } }] });
  };
  try {
    const response = await POST(new Request("http://localhost/api/ai/recipes", {
      method: "POST", headers: authHeaders, body: JSON.stringify({
        query: "What else could I make?",
        history: [{ role: "user", text: "I have chickpeas and feta" }],
      }),
    }));
    const reply = await response.json();
    assert.equal(reply.kind, "chat");
    assert.equal(reply.suggestions.length, 2);
    assert.equal(sent.messages.at(-2).content, "I have chickpeas and feta");
  } finally { restore(); }
});

test("unrelated questions receive a scoped reply without unrelated content", async () => {
  process.env.GROQ_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;
  let sent;
  globalThis.fetch = async (_url, options) => {
    const session = validSession(_url, options);
    if (session) return session;
    sent = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      kind: "out_of_scope", message: "Use Array.prototype.filter for this JavaScript array.",
      title: "", ingredients: [], steps: [], suggestions: [], links: [],
    }) } }] });
  };
  try {
    const response = await POST(new Request("http://localhost/api/ai/recipes", {
      method: "POST", headers: authHeaders, body: JSON.stringify({ query: "How do I filter a JavaScript array?" }),
    }));
    assert.equal(response.status, 200);
    const reply = await response.json();
    assert.match(reply.message, /recipes, ingredients, and shopping lists/i);
    assert.doesNotMatch(reply.message, /Array\.prototype/);
    assert.deepEqual(reply.suggestions, []);
    assert.match(sent.messages[0].content, /outside that scope/);
    assert.match(sent.messages[0].content, /shopping lists/);
  } finally { restore(); }
});

test("recipe follow-ups include the original ingredient names and amounts in AI history", async () => {
  process.env.GROQ_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;
  let sent;
  globalThis.fetch = async (_url, options) => {
    const session = validSession(_url, options);
    if (session) return session;
    sent = JSON.parse(options.body);
    return Response.json({choices: [{message: {content: JSON.stringify({
      kind: "recipe", message: "Serve with warm pita.", title: "Halloumi salad with pita",
      ingredients: ["½ cucumber, diced", "200g halloumi, sliced", "2 pita breads"],
      steps: ["Warm the pita and serve alongside."], suggestions: [], links: [],
    })}}]});
  };
  try {
    const response = await POST(new Request("http://localhost/api/ai/recipes", {
      method: "POST", headers: authHeaders, body: JSON.stringify({query: "Serve with warm pita bread", history: [{
        role: "assistant", text: "Here is a fresh salad.",
        recipe: {title: "Halloumi salad", ingredients: ["½ cucumber, diced", "200g halloumi, sliced"]},
      }]}),
    }));
    assert.equal(response.status, 200);
    assert.match(sent.messages.at(-2).content, /½ cucumber, diced/);
    assert.match(sent.messages.at(-2).content, /200g halloumi, sliced/);
    assert.match(sent.messages[0].content, /preserve the existing ingredient names and quantities exactly/);
  } finally { restore(); }
});

for (const authorization of [null, "Basic invalid", "Bearer "]) {
  test(`missing or malformed authorization blocks AI calls: ${authorization}`, async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("Must not fetch"); };
    const response = await POST(new Request("http://localhost/api/ai/recipes", {
      method: "POST", headers: authorization ? {Authorization: authorization} : {},
      body: JSON.stringify({query: "Dinner ideas"}),
    }));
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
  });
}

for (const [name, authResponse, expectedStatus] of [
  ["expired token", () => Response.json({error: "expired"}, {status: 401}), 401],
  ["rejected token", () => Response.json({error: "forbidden"}, {status: 403}), 401],
  ["backend error", () => Response.json({}, {status: 500}), 503],
  ["missing identity", () => Response.json({}), 503],
  ["anonymous identity", () => Response.json({id: 0}), 503],
  ["network failure", () => { throw new Error("offline"); }, 503],
]) {
  test(`${name} never reaches a paid AI provider`, async () => {
    let calls = 0;
    process.env.GROQ_API_KEY = "test-key";
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, sessionUrl);
      assert.equal(options.headers.Authorization, authHeaders.Authorization);
      return authResponse();
    };
    const response = await POST(new Request("http://localhost/api/ai/recipes", {
      method: "POST", headers: authHeaders, body: JSON.stringify({query: "Dinner ideas"}),
    }));
    assert.equal(response.status, expectedStatus);
    assert.equal(calls, 1);
  });
}

test("an exhausted account quota does not reach a paid provider", async () => {
  let calls = 0;
  globalThis.fetch = async (url) => { calls++; assert.equal(url, sessionUrl); return Response.json({message: 'Limit reached'}, {status: 429}); };
  const response = await POST(new Request('https://lista.test/api/ai/recipes', {method: 'POST', headers: authHeaders, body: JSON.stringify({query: 'Pasta recipe'})}));
  assert.equal(response.status, 429); assert.equal(calls, 1);
});
