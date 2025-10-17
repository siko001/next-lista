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
    const messagesContainerRef = useRef(null);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            text: "Hi! Ask me for a recipe, e.g. 'I plan to make lasagna'",
        },
    ]);
    const [pendingRecipe, setPendingRecipe] = useState(null);
    const [lastRecipe, setLastRecipe] = useState(null);
    const [canReadd, setCanReadd] = useState(false);
    const [listEmptied, setListEmptied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editedIngredients, setEditedIngredients] = useState([]);
    const [editingRecipe, setEditingRecipe] = useState(false);
    const lenisRef = useRef(null);
    const globalLenis =
        typeof window !== "undefined" && window.globalLenis
            ? window.globalLenis
            : null;

    const token = propToken || ctxToken;

    // Auto-scroll to bottom on new messages/open/editor changes
    useEffect(() => {
        if (!open) return;
        const el = messagesContainerRef.current;
        if (el) {
            // scroll after layout with smooth behavior
            requestAnimationFrame(() => {
                try {
                    el.scrollTo({top: el.scrollHeight, behavior: "smooth"});
                } catch {
                    el.scrollTop = el.scrollHeight;
                }
            });
        }
    }, [messages, open, editedIngredients, pendingRecipe]);

    useEffect(() => {
        if (pendingRecipe?.ingredients) {
            setEditedIngredients([...pendingRecipe.ingredients]);
            setEditingRecipe(false);
        } else {
            setEditedIngredients([]);
            setEditingRecipe(false);
        }
    }, [pendingRecipe]);

    // Only show Re-add after user empties the list (list context)
    useEffect(() => {
        if (context !== "list") return;
        const handler = (e) => {
            const {listId: evtListId} = e?.detail || {};
            if (parseInt(evtListId) === parseInt(propListId)) {
                // Mark that the current list was emptied; re-add becomes possible when lastRecipe exists
                setListEmptied(true);
                setCanReadd(!!lastRecipe);
            }
        };
        if (typeof window !== "undefined") {
            window.addEventListener("lista:list-emptied", handler);
        }
        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener("lista:list-emptied", handler);
            }
        };
    }, [context, propListId, lastRecipe]);

    // If lastRecipe gets set after the list was emptied, allow re-add
    useEffect(() => {
        if (context === "list" && listEmptied && lastRecipe) {
            setCanReadd(true);
        }
    }, [context, listEmptied, lastRecipe]);

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

        if (pendingRecipe) {
            const lower = text.toLowerCase();
            const removeMatch = lower.match(/^remove\s+(.+)$/);
            const addMatch = lower.match(/^add\s+(\d+x\s+)?(.+)$/);
            const replaceMatch = lower.match(/^replace\s+(.+)\s+with\s+(.+)$/);

            if (removeMatch) {
                const item = removeMatch[1].trim();
                setEditedIngredients((prev) =>
                    prev.filter((x) => x.toLowerCase() !== item)
                );
                setMessages((prev) => [
                    ...prev,
                    {role: "assistant", text: `Removed: ${item}`},
                ]);
                return;
            }
            if (addMatch) {
                const qtyPrefix = addMatch[1] || "";
                const item = (qtyPrefix + addMatch[2]).trim();
                setEditedIngredients((prev) => [...prev, item]);
                setMessages((prev) => [
                    ...prev,
                    {role: "assistant", text: `Added: ${item}`},
                ]);
                return;
            }
            if (replaceMatch) {
                const from = replaceMatch[1].trim();
                const to = replaceMatch[2].trim();
                setEditedIngredients((prev) => {
                    const idx = prev.findIndex(
                        (x) => x.toLowerCase() === from.toLowerCase()
                    );
                    if (idx === -1) return prev;
                    const copy = [...prev];
                    copy[idx] = to;
                    return copy;
                });
                setMessages((prev) => [
                    ...prev,
                    {role: "assistant", text: `Replaced ${from} with ${to}`},
                ]);
                return;
            }
        }

        // Prefer AI endpoint, fallback to local map
        let aiTitle = null;
        let aiIngredients = null;
        try {
            const resp = await fetch("/api/ai/recipes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: text }),
            });
            if (resp.ok) {
                const data = await resp.json();
                aiTitle = (data?.title || "").trim();
                aiIngredients = Array.isArray(data?.ingredients)
                    ? data.ingredients.map((s) => String(s || "").trim()).filter(Boolean)
                    : null;
            }
        } catch {}

        const title = aiTitle || parseRecipeRequest(text);
        const ingredients = aiIngredients || findIngredients(title);
        const normalizedTitle = title
            ? title.charAt(0).toUpperCase() + title.slice(1)
            : "Recipe";

        const reply = `For ${normalizedTitle}, you'll need: \n- ${ingredients.join("\n- ")}\n\nEdit the list below and confirm when ready.`;
        setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
        setPendingRecipe({ title: normalizedTitle, ingredients });
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

            // Announce AI bulk adding start
            try {
                window.dispatchEvent(new CustomEvent("lista:ai-adding-start"));
            } catch {}

            const toAdd = editedIngredients?.length
                ? editedIngredients.filter((s) => !!s && s.trim() !== "")
                : pendingRecipe.ingredients;
            for (const ing of toAdd) {
                await addItemToList(targetListId, ing);
            }

            showNotification("Ingredients added to your list", "success", 1200);
            setMessages((prev) => [
                ...prev,
                {role: "assistant", text: "Done! Ingredients added."},
            ]);
            setLastRecipe({title: pendingRecipe.title, ingredients: toAdd});
            setPendingRecipe(null);
        } finally {
            // Announce AI bulk adding end
            try {
                window.dispatchEvent(new CustomEvent("lista:ai-adding-end"));
            } catch {}
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
                <div className="fixed right-4 sm:right-6 bottom-6 z-[9999] max-w-[350px] sm:w-[380px] max-h-[75vh] sm:max-h-[70vh] rounded-md border bg-white dark:bg-black dark:text-white shadow-2xl overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 border-b dark:border-gray-700 shrink-0">
                        <div className="font-bold">Recipe Assistant (Mock)</div>
                        <button
                            className="no-border cursor-pointer text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                            onClick={() => setOpen(false)}
                        >
                            ✕
                        </button>
                    </div>

                    <div
                        ref={messagesContainerRef}
                        id="lista-chat-scroll"
                        data-lenis-prevent
                        data-scroll-lock-scrollable
                        className="overflow-y-auto overscroll-contain p-3 pb-12 space-y-2 text-sm"
                        style={{
                            WebkitOverflowScrolling: "touch",
                            touchAction: "pan-y",
                            overscrollBehavior: "contain",
                            scrollBehavior: "smooth",
                        }}
                        onWheelCapture={(e) => {
                            e.stopPropagation();
                        }}
                        onTouchMoveCapture={(e) => {
                            e.stopPropagation();
                        }}
                    >
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

                        {pendingRecipe && !editingRecipe && (
                            <div className="mt-3 space-y-2">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Ready to add ingredients for:{" "}
                                    {pendingRecipe.title}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        disabled={loading}
                                        onClick={handleConfirmAdd}
                                        className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                                    >
                                        {loading ? "Adding..." : "Add"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingRecipe(true)}
                                        className="px-3 py-1 rounded border dark:border-gray-700"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        disabled={loading}
                                        onClick={handleCancel}
                                        className="px-3 py-1 rounded border dark:border-gray-700"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {pendingRecipe && editingRecipe && (
                            <div className="mt-3 space-y-2">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Editing ingredients for:{" "}
                                    {pendingRecipe.title}
                                </div>

                                <div className="space-y-2">
                                    {editedIngredients.map((ing, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-2"
                                        >
                                            <input
                                                value={ing}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setEditedIngredients(
                                                        (prev) => {
                                                            const copy = [
                                                                ...prev,
                                                            ];
                                                            copy[idx] = v;
                                                            return copy;
                                                        }
                                                    );
                                                }}
                                                className="flex-1 rounded-md border dark:border-gray-700 px-2 py-1 bg-white dark:bg-black text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setEditedIngredients(
                                                        (prev) =>
                                                            prev.filter(
                                                                (_, i) =>
                                                                    i !== idx
                                                            )
                                                    )
                                                }
                                                className="px-2 py-1 rounded border dark:border-gray-700 text-sm"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setEditedIngredients((prev) => [
                                                ...prev,
                                                "",
                                            ])
                                        }
                                        className="px-3 py-1 rounded border dark:border-gray-700"
                                    >
                                        + Add item
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setEditedIngredients([
                                                ...(pendingRecipe?.ingredients ||
                                                    []),
                                            ])
                                        }
                                        className="px-3 py-1 rounded border dark:border-gray-700"
                                    >
                                        Reset
                                    </button>
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button
                                        disabled={loading}
                                        onClick={handleConfirmAdd}
                                        className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                                    >
                                        {loading ? "Adding..." : "Add to list"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingRecipe(false)}
                                        className="px-3 py-1 rounded border dark:border-gray-700"
                                    >
                                        Back
                                    </button>
                                    <button
                                        disabled={loading}
                                        onClick={handleCancel}
                                        className="px-3 py-1 rounded border dark:border-gray-700"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {!pendingRecipe &&
                            context === "list" &&
                            lastRecipe &&
                            canReadd && (
                                <div className="mt-2">
                                    <button
                                        disabled={loading}
                                        onClick={async () => {
                                            setLoading(true);
                                            try {
                                                // Suppress realtime toasts during re-add
                                                try {
                                                    window.dispatchEvent(
                                                        new CustomEvent(
                                                            "lista:ai-adding-start"
                                                        )
                                                    );
                                                } catch {}
                                                let targetListId = propListId;
                                                for (const ing of lastRecipe.ingredients) {
                                                    await addItemToList(
                                                        targetListId,
                                                        ing
                                                    );
                                                }
                                                showNotification(
                                                    "Re-added ingredients",
                                                    "success",
                                                    1200
                                                );
                                                setCanReadd(false);
                                                setListEmptied(false);
                                            } finally {
                                                try {
                                                    window.dispatchEvent(
                                                        new CustomEvent(
                                                            "lista:ai-adding-end"
                                                        )
                                                    );
                                                } catch {}
                                                setLoading(false);
                                            }
                                        }}
                                        className="px-3 py-1 rounded border dark:border-gray-700"
                                    >
                                        Re-add {lastRecipe.title}
                                    </button>
                                </div>
                            )}
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="flex items-center gap-2 p-3 border-t dark:border-gray-700 shrink-0"
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
