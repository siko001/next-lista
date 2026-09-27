import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/ai/recipes/route.js";

const originalFetch = globalThis.fetch;
const originalGroqKey = process.env.GROQ_API_KEY;
const originalOpenAIKey = process.env.OPENAI_API_KEY;

function restore() {
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
      method: "POST", body: JSON.stringify({ query }),
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
    sent = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      kind: "chat", message: "Try a chickpea and feta salad or a warm grain bowl.",
      title: "", ingredients: [], steps: [],
      suggestions: ["Chickpea and feta salad", "Warm grain bowl"], links: [],
    }) } }] });
  };
  try {
    const response = await POST(new Request("http://localhost/api/ai/recipes", {
      method: "POST", body: JSON.stringify({
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
    sent = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      kind: "out_of_scope", message: "Use Array.prototype.filter for this JavaScript array.",
      title: "", ingredients: [], steps: [], suggestions: [], links: [],
    }) } }] });
  };
  try {
    const response = await POST(new Request("http://localhost/api/ai/recipes", {
      method: "POST", body: JSON.stringify({ query: "How do I filter a JavaScript array?" }),
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
    sent = JSON.parse(options.body);
    return Response.json({choices: [{message: {content: JSON.stringify({
      kind: "recipe", message: "Serve with warm pita.", title: "Halloumi salad with pita",
      ingredients: ["½ cucumber, diced", "200g halloumi, sliced", "2 pita breads"],
      steps: ["Warm the pita and serve alongside."], suggestions: [], links: [],
    })}}]});
  };
  try {
    const response = await POST(new Request("http://localhost/api/ai/recipes", {
      method: "POST", body: JSON.stringify({query: "Serve with warm pita bread", history: [{
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
