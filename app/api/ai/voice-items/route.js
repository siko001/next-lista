export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_ITEMS = 25;
const NON_ITEM = /^(?:thank(?:s| you)|okay|ok|bye|goodbye|that's it|that is it|done|stop|stop recording|continue|all done|finished)[.!?\s]*$/i;
const fallbackItems = (transcript) => transcript
    .split(/[,;\n]+/)
    .map((item) => item.replace(/^(?:please\s+)?(?:add|buy|we need|i need)\s+/i, "").trim())
    .filter((item) => item && !NON_ITEM.test(item))
    .slice(0, MAX_ITEMS);

const json = (body, status = 200) =>
    Response.json(body, {status, headers: {"Cache-Control": "no-store"}});
const reviewFallback = (transcript) => {
    const items = fallbackItems(transcript);
    return items.length
        ? json({transcript, items, needsReview: true})
        : json({error: "No shopping items were heard. Please try again."}, 422);
};

export async function POST(request) {
    const key = process.env.GROQ_API_KEY;
    if (!key) return json({error: "Voice input is not configured."}, 503);

    // Guest accounts also have a WordPress JWT, so NextAuth sessions alone cannot
    // authorize this paid transcription endpoint.
    const authorization = request.headers.get("authorization") || "";
    if (!/^Bearer\s+\S+$/.test(authorization)) {
        return json({error: "Please sign in to use voice input."}, 401);
    }

    try {
        const authResponse = await fetch(
            `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/wp-json/custom/v1/user-data`,
            {headers: {Authorization: authorization}, cache: "no-store"}
        );
        if (!authResponse.ok) return json({error: "Your session has expired."}, 401);

        const form = await request.formData();
        const audio = form.get("audio");
        if (!(audio instanceof File) || !audio.size || audio.size > MAX_AUDIO_BYTES) {
            return json({error: "Record a short voice note (up to 10 MB)."}, 400);
        }
        if (!/^(audio|video)\/(webm|mp4|mpeg|ogg|wav|x-m4a|m4a)/i.test(audio.type)) {
            return json({error: "This audio format is not supported."}, 400);
        }

        const transcriptionForm = new FormData();
        transcriptionForm.append("file", audio, `shopping-items.${audio.type.includes("mp4") ? "mp4" : "webm"}`);
        transcriptionForm.append("model", "whisper-large-v3");
        transcriptionForm.append("response_format", "json");
        transcriptionForm.append("language", "en");
        transcriptionForm.append(
            "prompt",
            "A shopping list spoken in English with a Maltese accent. Items can include toilet paper, tomatoes, tomato ketchup, and Maltese product names."
        );

        const transcriptionResponse = await fetch(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            {method: "POST", headers: {Authorization: `Bearer ${key}`}, body: transcriptionForm}
        );
        if (!transcriptionResponse.ok) {
            return json({error: "Could not transcribe the recording. Please try again."}, 502);
        }
        const transcription = await transcriptionResponse.json();
        const transcript = String(transcription.text || "").trim();
        if (!transcript) return json({error: "No speech was detected. Please try again."}, 422);
        if (["destination", "choice", "command"].includes(form.get("mode"))) return json({transcript});
        if (NON_ITEM.test(transcript)) return json({error: "No shopping items were heard. Please try again."}, 422);

        const extractionResponse = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {"Content-Type": "application/json", Authorization: `Bearer ${key}`},
                body: JSON.stringify({
                    model: process.env.GROQ_VOICE_MODEL || "openai/gpt-oss-20b",
                    temperature: 0,
                    response_format: {
                        type: "json_schema",
                        json_schema: {
                            name: "shopping_items",
                            strict: true,
                            schema: {
                                type: "object",
                                properties: {items: {type: "array", items: {type: "string"}}},
                                required: ["items"],
                                additionalProperties: false
                            }
                        }
                    },
                    messages: [
                        {
                            role: "system",
                            content: "Extract only the shopping products the speaker asks to add. Return JSON with an items array of short product names. Keep multiword products together (for example toilet paper and tomato ketchup). Do not invent products, quantities, or brands. Ignore conversational filler. Preserve Maltese names as spoken."
                        },
                        {role: "user", content: transcript}
                    ]
                })
            }
        );
        if (!extractionResponse.ok) {
            console.error("Voice item extraction failed:", extractionResponse.status, await extractionResponse.text());
            return reviewFallback(transcript);
        }
        const extraction = await extractionResponse.json();
        let parsed;
        try {
            parsed = JSON.parse(extraction?.choices?.[0]?.message?.content || "{}");
        } catch {
            return reviewFallback(transcript);
        }
        const items = Array.isArray(parsed.items)
            ? parsed.items
                .filter((item) => typeof item === "string")
                .map((item) => item.trim())
                .filter((item) => item && !NON_ITEM.test(item))
                .slice(0, MAX_ITEMS)
            : [];
        if (!items.length) return reviewFallback(transcript);
        return json({transcript, items});
    } catch (error) {
        console.error("Voice item processing failed:", error);
        return json({error: "Voice input failed. Please try again."}, 500);
    }
}
