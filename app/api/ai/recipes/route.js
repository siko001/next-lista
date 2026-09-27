export const runtime = "nodejs";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "message", "title", "ingredients", "steps", "suggestions", "links"],
  properties: {
    kind: { type: "string", enum: ["recipe", "chat", "out_of_scope"] },
    message: { type: "string" },
    title: { type: "string" },
    ingredients: { type: "array", items: { type: "string" } },
    steps: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
    links: { type: "array", items: { type: "string" } },
  },
};

const system = `You are Lista, a cooking, recipe and shopping-list assistant. Your scope is meals, recipes, ingredients, food preparation, grocery products, and the user's shopping lists. Reply naturally to in-scope requests, including informal wording and misspellings. Keep continuity with the recent conversation. You can suggest meals, sides, substitutions, quantities and cooking tips. Never insist on a specific command phrase. When the user asks for more ideas, keep their preferences and suggest dishes different from those in the recent conversation. When adding a side or extending an earlier recipe, preserve the existing ingredient names and quantities exactly unless the user requests a substitution or a change in servings. Include the new ingredients for the side. Shorten preparation notes rather than abbreviating ingredient names.

If the latest user request is outside that scope, use kind "out_of_scope". Do not answer the unrelated request, even if it is easy or appears in conversation history. For example, a question about JavaScript arrays is out of scope. Briefly invite the user to ask about a recipe, ingredients, or a shopping list. Leave title, ingredients, steps, suggestions, and links empty. Greetings and short conversational follow-ups about food or lists are in scope.

Return only a JSON object matching the requested schema. Use kind "recipe" when the user asks how to make a dish or wants ingredients for a dish. A meal with a side is one recipe response: include both in the title, ingredients and steps. Give a short conversational message, a useful shopping ingredient list with short individual item names (36 characters or fewer), and concise practical steps. Use kind "chat" for meal recommendations, food and shopping-list questions, greetings, and in-scope conversation; put the useful answer in message, and leave title, ingredients and steps empty. For recommendations, give 2-4 specific ideas in the message and suggestions array. Ask a clarifying question only if a useful answer truly depends on it. Use markdown sparingly for readability. Do not invent source URLs: only include an https URL in links when it appeared in the user's conversation. Never claim to have checked a website or a product catalog.`;

function cleanStrings(value, maxItems, maxLength) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").map((item) => item.trim().slice(0, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function normalizeAssistantReply(value) {
  if (!value || typeof value !== "object" || typeof value.message !== "string") return null;
  if (value.kind === "out_of_scope") return {
    kind: "chat",
    message: "I can help with recipes, ingredients, and shopping lists. What would you like to make or add?",
    title: "",
    ingredients: [],
    steps: [],
    suggestions: [],
    links: [],
  };
  const kind = value.kind === "recipe" ? "recipe" : "chat";
  const title = typeof value.title === "string" ? value.title.trim().slice(0, 120) : "";
  const ingredients = cleanStrings(value.ingredients, 40, 36);
  if (kind === "recipe" && (!title || !ingredients.length)) return null;
  return {
    kind,
    message: value.message.trim().slice(0, 3000),
    title: kind === "recipe" ? title : "",
    ingredients: kind === "recipe" ? ingredients : [],
    steps: kind === "recipe" ? cleanStrings(value.steps, 12, 500) : [],
    suggestions: cleanStrings(value.suggestions, 4, 100),
    links: cleanStrings(value.links, 3, 2000).filter((url) => {
      try { return new URL(url).protocol === "https:"; } catch { return false; }
    }),
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim().slice(0, 2000) : "";
    if (!query) return Response.json({ error: "Please enter a message." }, { status: 400 });

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!groqKey && !openaiKey) return Response.json({ error: "AI is not configured." }, { status: 503 });

    const useOpenAI = Boolean(openaiKey);
    const model = useOpenAI
      ? process.env.OPENAI_MODEL || "gpt-4o-mini"
      : process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    const history = Array.isArray(body.history) ? body.history : [];
    const variation = typeof body.variationKey === "string" && typeof body.baseDish === "string"
      ? `Please make the ${body.variationKey.slice(0, 60)} variation of ${body.baseDish.slice(0, 100)}. ${query}`
      : query;
    const messages = [
      { role: "system", content: system },
      ...history.slice(-10).filter((item) => item?.role === "user" || item?.role === "assistant")
        .map((item) => {
          const recipe = item.role === "assistant" && item.recipe;
          const ingredients = recipe ? cleanStrings(recipe.ingredients, 40, 100) : [];
          const recipeContext = ingredients.length
            ? `\nRecipe: ${String(recipe.title || "").slice(0, 120)}\nIngredients:\n${ingredients.map((ingredient) => `- ${ingredient}`).join("\n")}`
            : "";
          return {role: item.role, content: String(item.text || "").slice(0, 1200) + recipeContext};
        }),
      { role: "user", content: variation },
    ];
    const supportsSchema = useOpenAI || /^openai\/gpt-oss-(20b|120b)$/.test(model);
    const responseFormat = supportsSchema
      ? { type: "json_schema", json_schema: { name: "lista_reply", strict: true, schema: responseSchema } }
      : { type: "json_object" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let resp;
    try {
      resp = await fetch(useOpenAI ? "https://api.openai.com/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${useOpenAI ? openaiKey : groqKey}`,
          ...(useOpenAI && process.env.OPENAI_ORG_ID ? { "OpenAI-Organization": process.env.OPENAI_ORG_ID } : {}),
        },
        body: JSON.stringify({ model, messages, response_format: responseFormat, temperature: 0.7 }),
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!resp.ok) return Response.json({ error: "The assistant is temporarily unavailable." }, { status: 502 });
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = null; }
    const reply = normalizeAssistantReply(parsed);
    if (!reply) return Response.json({ error: "The assistant couldn't finish that reply. Please try again." }, { status: 502 });
    return Response.json(reply);
  } catch {
    return Response.json({ error: "The assistant is temporarily unavailable." }, { status: 502 });
  }
}
