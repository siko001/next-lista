export const runtime = "nodejs";

function extractJSON(text) {
    try {
        return JSON.parse(text);
    } catch {}
    // try to extract JSON block
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch {}
    }
    return null;
}

export async function POST(req) {
    try {
        const {query} = await req.json();
        if (!query || typeof query !== "string") {
            return new Response(
                JSON.stringify({error: "Missing 'query' string in body"}),
                {status: 400, headers: {"Content-Type": "application/json"}}
            );
        }

        const groqKey = process.env.GROQ_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!groqKey && !openaiKey) {
            return new Response(
                JSON.stringify({
                    error: "No AI provider configured. Set GROQ_API_KEY or OPENAI_API_KEY.",
                }),
                {status: 500, headers: {"Content-Type": "application/json"}}
            );
        }

        const system = `You are a cooking assistant. Given a user request, extract a concise recipe title and a clean list of ingredients (short names, one per item). Respond ONLY in strict JSON with keys: title (string), ingredients (array of strings). No commentary.`;

        const user = `User request: ${query}`;

        let resp;
        if (groqKey) {
            resp = await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${groqKey}`,
                    },
                    body: JSON.stringify({
                        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
                        messages: [
                            {role: "system", content: system},
                            {role: "user", content: user},
                        ],
                        temperature: 0.2,
                    }),
                }
            );
        } else {
            resp = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${openaiKey}`,
                    ...(process.env.OPENAI_ORG_ID
                        ? {"OpenAI-Organization": process.env.OPENAI_ORG_ID}
                        : {}),
                },
                body: JSON.stringify({
                    model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
                    messages: [
                        {role: "system", content: system},
                        {role: "user", content: user},
                    ],
                    temperature: 0.2,
                }),
            });
        }

        if (!resp.ok) {
            let details;
            try {
                details = await resp.json();
            } catch {
                details = await resp.text();
            }
            return new Response(
                JSON.stringify({error: "Upstream error", details}),
                {status: 502, headers: {"Content-Type": "application/json"}}
            );
        }

        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content || "";
        const parsed = extractJSON(content);

        if (!parsed || !parsed.title || !Array.isArray(parsed.ingredients)) {
            return new Response(
                JSON.stringify({error: "Bad AI response", raw: content}),
                {status: 502, headers: {"Content-Type": "application/json"}}
            );
        }

        const title = String(parsed.title).trim();
        const ingredients = parsed.ingredients
            .map((s) => String(s || "").trim())
            .filter((s) => !!s);

        return new Response(JSON.stringify({title, ingredients}), {
            status: 200,
            headers: {"Content-Type": "application/json"},
        });
    } catch (err) {
        return new Response(
            JSON.stringify({error: "Server error", details: String(err)}),
            {status: 500, headers: {"Content-Type": "application/json"}}
        );
    }
}
