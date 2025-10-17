"use client";
import {useCallback, useMemo, useRef, useState, useEffect} from "react";
import {useUserContext} from "../contexts/UserContext";
import {useListContext} from "../contexts/ListContext";
import {useNotificationContext} from "../contexts/NotificationContext";
import {decryptToken, WP_API_BASE, decodeHtmlEntities} from "../lib/helpers";

export default function ChatWidget({
    context = "home",
    listId: propListId,
    token: propToken,
}) {
    const {userData, token: ctxToken} = useUserContext();
    const {createShoppingList, getShoppingList} = useListContext();
    const {showNotification} = useNotificationContext();

    const [open, setOpen] = useState(false);
    const inputRef = useRef(null);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            text: "Hi! Ask me for a recipe, e.g. 'I plan to make lasagna'",
        },
    ]);
    const [pendingRecipe, setPendingRecipe] = useState(null);
    const [loading, setLoading] = useState(false);

    const token = propToken || ctxToken;

    // Simple caches to avoid repeated fetching during a session
    const productsCacheRef = useRef({all: null, custom: null});

    // Very small mock recipe map
    const recipeMap = useMemo(
        () => ({
            lasagna: [
                "Lasagna noodles",
                "Ground beef",
                "Tomato sauce",
                "Onion",
                "Garlic",
                "Ricotta",
                "Mozzarella",
                "Parmesan",
                "Olive oil",
                "Salt",
                "Pepper",
            ],
            pancakes: [
                "Flour",
                "Milk",
                "Eggs",
                "Sugar",
                "Baking powder",
                "Salt",
                "Butter",
            ],
            salad: [
                "Lettuce",
                "Tomatoes",
                "Cucumber",
                "Olive oil",
                "Lemon",
                "Salt",
                "Pepper",
            ],
        }),
        []
    );

    const parseRecipeRequest = useCallback((text) => {
        if (!text) return null;
        const t = text.toLowerCase();
        // simple extraction: find keyword after 'make' or 'doing' or 'cook'
        const patterns = [
            /make\s+(?:a\s+|an\s+)?([^.?]+)/i,
            /doing\s+(?:a\s+|an\s+)?([^.?]+)/i,
            /cook(?:ing)?\s+(?:a\s+|an\s+)?([^.?]+)/i,
            /plan(?:ning)?\s+to\s+make\s+(?:a\s+|an\s+)?([^.?]+)/i,
            /recipe\s+for\s+([^.?]+)/i,
        ];
        for (const p of patterns) {
            const m = text.match(p);
            if (m && m[1]) {
                return m[1].trim();
            }
        }
        // fallback: first word
        return text.trim();
    }, []);

    const findIngredients = useCallback(
        (recipeTitle) => {
            if (!recipeTitle) return [];
            const key = recipeTitle.toLowerCase().split(" ")[0];
            if (recipeMap[key]) return recipeMap[key];
            // fallback generic ingredients
            return ["Salt", "Pepper", "Olive oil"];
        },
        [recipeMap]
    );

    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        const text = input.trim();
        if (!text) return;
        setMessages((prev) => [...prev, {role: "user", text}]);
        setInput("");

        const title = parseRecipeRequest(text);
        const ingredients = findIngredients(title);
        const normalizedTitle = title
            ? title.charAt(0).toUpperCase() + title.slice(1)
            : "Recipe";

        const reply = `For ${normalizedTitle}, you'll need: \n- ${ingredients.join(
            "\n- "
        )}\n\nAdd these to your list?`;
        setMessages((prev) => [...prev, {role: "assistant", text: reply}]);
        setPendingRecipe({title: normalizedTitle, ingredients});
    };

    const ensureListForHome = useCallback(async () => {
        if (!userData?.id || !token) return null;
        const name = `Items for: ${pendingRecipe.title}`;
        const data = await createShoppingList({
            name,
            userId: userData.id,
            token,
        });
        try {
            await getShoppingList(userData.id, token);
        } catch {}
        return data?.id || data?.list?.id || null;
    }, [
        createShoppingList,
        getShoppingList,
        pendingRecipe?.title,
        token,
        userData?.id,
    ]);

    const loadProductPools = useCallback(async () => {
        if (!token) return {all: [], custom: []};
        if (productsCacheRef.current.all && productsCacheRef.current.custom) {
            return productsCacheRef.current;
        }
        const authToken = context === "list" ? decryptToken(token) : token;
        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        };
        let all = [];
        let custom = [];
        try {
            const resAll = await fetch(`${WP_API_BASE}/custom/v1/products`, {
                method: "GET",
                headers,
            });
            all = await resAll.json();
        } catch {}
        try {
            const resCustom = await fetch(
                `${WP_API_BASE}/custom/v1/get-custom-products`,
                {
                    method: "GET",
                    headers,
                }
            );
            custom = await resCustom.json();
        } catch {}
        productsCacheRef.current = {all: all || [], custom: custom || []};
        return productsCacheRef.current;
    }, [token, context]);

    const resolveProductIdByTitle = useCallback(
        async (title) => {
            const pools = await loadProductPools();
            const norm = (s) => (s || "").toString().toLowerCase().trim();
            const target = norm(title);

            // Search core products first
            const core = pools.all?.find(
                (p) => norm(decodeHtmlEntities(p.title)) === target
            );
            if (core?.id) return {id: core.id, source: "core"};

            // Then search custom products
            const custom = pools.custom?.find((p) => norm(p.title) === target);
            if (custom?.id) return {id: custom.id, source: "custom"};

            return {id: null, source: null};
        },
        [loadProductPools]
    );

    const addItemToList = useCallback(
        async (shoppingListId, title) => {
            if (!shoppingListId || !token) return;
            // Use decrypted token only when inside a list page (encrypted token there)
            const authToken = context === "list" ? decryptToken(token) : token;
            // 1) Try to resolve product id from existing pools
            let {id: productId} = await resolveProductIdByTitle(title);

            // 2) If not found, create a custom product once
            if (!productId) {
                try {
                    const res = await fetch(
                        `${WP_API_BASE}/custom/v1/create-custom-product`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${authToken}`,
                            },
                            body: JSON.stringify({title}),
                        }
                    );
                    const data = await res.json();
                    productId =
                        data?.id ||
                        data?.product_id ||
                        data?.product?.id ||
                        null;

                    // Update cache to include this newly created custom item
                    if (productId) {
                        const pools = productsCacheRef.current;
                        if (pools?.custom) {
                            pools.custom = [
                                {id: productId, title},
                                ...pools.custom,
                            ];
                        }
                    }
                } catch (err) {
                    // ignore
                }
            }

            if (!productId) return; // give up if we couldn't get/create an id

            try {
                await fetch(`${WP_API_BASE}/custom/v1/update-shopping-list`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({
                        shoppingListId,
                        productId,
                        action: "add",
                    }),
                });
                // Optimistic UI: notify list page
                try {
                    const evt = new CustomEvent("lista:items-added", {
                        detail: {
                            listId: shoppingListId,
                            items: [{id: productId, title}],
                        },
                    });
                    window.dispatchEvent(evt);
                } catch {}
            } catch (err) {
                // noop minimal
            }
        },
        [token, context, resolveProductIdByTitle]
    );

    const handleConfirmAdd = async () => {
        if (!pendingRecipe) return;
        setLoading(true);
        try {
            let targetListId = propListId;
            if (context === "home") {
                targetListId = await ensureListForHome();
                if (!targetListId) {
                    showNotification("Failed to create list", "error");
                    setLoading(false);
                    return;
                }
                showNotification(
                    `Created list: Items for: ${pendingRecipe.title}`,
                    "success",
                    1200
                );
            }

            // Add each ingredient
            for (const ing of pendingRecipe.ingredients) {
                await addItemToList(targetListId, ing);
            }

            showNotification("Ingredients added to your list", "success", 1200);
            setMessages((prev) => [
                ...prev,
                {role: "assistant", text: "Done! Ingredients added."},
            ]);
            setPendingRecipe(null);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setPendingRecipe(null);
        setMessages((prev) => [
            ...prev,
            {role: "assistant", text: "Okay, ask for another recipe anytime."},
        ]);
    };

    return (
        <div className="relative z-[9999]">
            {!open && (
                <button
                    onClick={() => {
                        setOpen(true);
                        if (typeof window !== "undefined") {
                            requestAnimationFrame(() => {
                                inputRef.current?.focus?.();
                            });
                        }
                    }}
                    className="fixed bottom-6 right-6 z-40 rounded-full bg-blue-600 text-white px-4 py-3 shadow-lg hover:opacity-90 transition-opacity"
                >
                    Ask AI
                </button>
            )}

            {open && (
                <div className="fixed bottom-6 right-6 z-[9999] w-[320px] sm:w-[380px] rounded-md border bg-white dark:bg-black dark:text-white shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b dark:border-gray-700">
                        <div className="font-bold">Recipe Assistant (Mock)</div>
                        <button
                            className="no-border cursor-pointer text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                            onClick={() => setOpen(false)}
                        >
                            ✕
                        </button>
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto p-3 space-y-2 text-sm">
                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={
                                    m.role === "user"
                                        ? "text-right"
                                        : "text-left"
                                }
                            >
                                <span
                                    className={`inline-block px-3 py-2 rounded-md ${
                                        m.role === "user"
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-100 dark:bg-gray-800"
                                    }`}
                                >
                                    {m.text}
                                </span>
                            </div>
                        ))}

                        {pendingRecipe && (
                            <div className="mt-2 flex gap-2">
                                <button
                                    disabled={loading}
                                    onClick={handleConfirmAdd}
                                    className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                                >
                                    {loading ? "Adding..." : "Add to list"}
                                </button>
                                <button
                                    disabled={loading}
                                    onClick={handleCancel}
                                    className="px-3 py-1 rounded border dark:border-gray-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="flex items-center gap-2 p-3 border-t dark:border-gray-700"
                    >
                        <input
                            ref={inputRef}
                            autoFocus
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask for a recipe..."
                            className="flex-1 rounded-md border dark:border-gray-700 px-3 py-2 bg-white dark:bg-black"
                        />
                        <button
                            type="submit"
                            className="px-3 py-2 cursor-pointer rounded-md bg-blue-600 text-white"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
