"use client";
import {useCallback, useMemo, useRef, useState, useEffect} from "react";
import {gsap} from "gsap";
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
    const [mounted, setMounted] = useState(false);
    const panelRef = useRef(null);
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
    const [typing, setTyping] = useState(false);
    const [pendingVariation, setPendingVariation] = useState(null);
    const [editedIngredients, setEditedIngredients] = useState([]);
    const [editingRecipe, setEditingRecipe] = useState(false);
    const ingredientInputRefs = useRef([]);
    const [focusIndex, setFocusIndex] = useState(null);
    const lenisRef = useRef(null);
    const globalLenis =
        typeof window !== "undefined" && window.globalLenis
            ? window.globalLenis
            : null;
    const lastQueryRef = useRef("");
    const ingredientContextRef = useRef(null);

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

    // Animate modal open/close with GSAP: height 0 <-> auto (0.7s)
    useEffect(() => {
        const el = panelRef.current;
        if (!el) return;

        // respect reduced motion optionally (can be extended later)
        const prefersReduced =
            typeof window !== "undefined" &&
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (open) {
            setMounted(true);
            // start from collapsed and expand to auto
            gsap.killTweensOf(el);
            gsap.set(el, {height: 0, overflow: "hidden"});
            gsap.to(el, {
                height: "auto",
                duration: prefersReduced ? 0 : 0.5,
                ease: "power2.out",
                onComplete: () => {
                    // keep auto after
                    gsap.set(el, {clearProps: "height"});
                },
            });
        } else if (mounted) {
            // collapse to 0 then unmount
            gsap.killTweensOf(el);
            const currentHeight = el.scrollHeight;
            gsap.set(el, {height: currentHeight, overflow: "hidden"});
            gsap.to(el, {
                height: 0,
                duration: prefersReduced ? 0 : 0.3,
                ease: "power2.in",
                onComplete: () => setMounted(false),
            });
        }
    }, [open, mounted]);

    useEffect(() => {
        if (pendingRecipe?.ingredients) {
            setEditedIngredients([...pendingRecipe.ingredients]);
            setEditingRecipe(false);
        } else {
            setEditedIngredients([]);
            setEditingRecipe(false);
        }
    }, [pendingRecipe]);

    // After ingredients array changes, focus a specific input if requested
    useEffect(() => {
        if (focusIndex === null) return;
        requestAnimationFrame(() => {
            try {
                ingredientInputRefs.current[focusIndex]?.focus?.();
            } catch {}
            setFocusIndex(null);
        });
    }, [editedIngredients, focusIndex]);

    // Focus is only triggered when clicking '+ Add item' via focusIndex

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
                "Lasagna Sheet",
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
        if (typing || loading) return;
        setMessages((prev) => [...prev, {role: "user", text}]);
        setInput("");
        lastQueryRef.current = text;

        if (pendingVariation) {
            const lower = text.toLowerCase().trim();
            const options = pendingVariation.options || [];
            const norm = (s) => (s || "").toString().toLowerCase().trim();
            const lev = (a, b) => {
                const m = a.length,
                    n = b.length;
                const dp = Array.from({length: m + 1}, () =>
                    Array(n + 1).fill(0)
                );
                for (let i = 0; i <= m; i++) dp[i][0] = i;
                for (let j = 0; j <= n; j++) dp[0][j] = j;
                for (let i = 1; i <= m; i++) {
                    for (let j = 1; j <= n; j++) {
                        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                        dp[i][j] = Math.min(
                            dp[i - 1][j] + 1,
                            dp[i][j - 1] + 1,
                            dp[i - 1][j - 1] + cost
                        );
                    }
                }
                return dp[m][n];
            };
            let matchKey = null;
            for (const o of options) {
                const k = norm(o.key);
                const l = norm(o.label);
                if (
                    lower === k ||
                    lower === l ||
                    l.includes(lower) ||
                    k.includes(lower)
                ) {
                    matchKey = o.key;
                    break;
                }
                const d1 = lev(lower, k);
                const d2 = lev(lower, l);
                const threshold = Math.max(
                    1,
                    Math.floor(Math.min(k.length, l.length) * 0.4)
                );
                if (d1 <= threshold || d2 <= threshold) {
                    matchKey = o.key;
                    break;
                }
            }
            if (matchKey) {
                await handleSelectVariation(matchKey);
                return;
            }
            setPendingVariation(null);
            // continue as new request
        }

        // Detect alternate-intent like: "something else", "another one", etc. Use previous ingredient context if available
        const lowerText = text.toLowerCase();
        const altIntent =
            /\b(another|something else|what else|else|different|other option)\b/.test(
                lowerText
            );
        if (
            altIntent &&
            Array.isArray(ingredientContextRef.current) &&
            ingredientContextRef.current.length
        ) {
            setPendingVariation(null);
            setPendingRecipe(null);
        }

        if (pendingRecipe && !altIntent) {
            const lower = text.toLowerCase();
            const baseTitle = (pendingRecipe?.title || "").toLowerCase();
            const isBurgerLike = /burger|cheeseburger|sandwich|wrap/.test(
                baseTitle
            );

            if (isBurgerLike && /\bfries?\b/.test(lower)) {
                const toAdd = ["Potatoes", "Oil"];
                setEditedIngredients((prev) => {
                    const seed =
                        prev && prev.length
                            ? prev
                            : pendingRecipe?.ingredients || [];
                    const exists = (arr, item) =>
                        arr.some(
                            (x) =>
                                (x || "").toLowerCase() === item.toLowerCase()
                        );
                    const next = [...seed];
                    for (const it of toAdd)
                        if (!exists(next, it)) next.push(it);
                    return next;
                });
                setMessages((prev) => [
                    ...prev,
                    {role: "assistant", text: "Added: Fries (Potatoes, Oil)"},
                ]);
                return;
            }

            if (isBurgerLike && /\brice\b/.test(lower)) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        text: "Rice is usually a separate dish. Would you like a rice recipe instead? For example: Chicken Rice, Vegetable Rice, or Plain Rice.",
                    },
                ]);
                return;
            }
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
                let raw = (qtyPrefix + addMatch[2]).trim();
                raw = raw.replace(/\s+to\s+(it|the\s+list)$/i, "");
                const item = raw;
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
        setTyping(true);
        // If user asked for an alternative and we have ingredient context, steer the query to request another recipe with the same ingredients.
        let finalQuery = text;
        if (
            altIntent &&
            Array.isArray(ingredientContextRef.current) &&
            ingredientContextRef.current.length
        ) {
            const list = ingredientContextRef.current.join(", ");
            finalQuery = `Suggest another recipe using only: ${list}`;
        }
        try {
            const resp = await fetch("/api/ai/recipes", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    query: finalQuery,
                    ingredientsHint: ingredientContextRef.current || null,
                    alternate: !!altIntent,
                }),
            });
            if (resp.ok) {
                const data = await resp.json();
                aiTitle = (data?.title || "").trim();
                aiIngredients = Array.isArray(data?.ingredients)
                    ? data.ingredients
                          .map((s) => String(s || "").trim())
                          .filter(Boolean)
                    : null;
                var apiVariations = Array.isArray(data?.variations)
                    ? data.variations
                    : null;
                var apiVariationQuestion = data?.variationQuestion || null;
            }
        } catch {}

        const title = aiTitle || parseRecipeRequest(text);
        const ingredients = aiIngredients || findIngredients(title);
        const normalizedTitle = title
            ? title.charAt(0).toUpperCase() + title.slice(1)
            : "Recipe";

        const keyCheck = (title || "").toLowerCase().split(" ")[0];
        const titleLooksUnknown = (title || "")
            .toLowerCase()
            .includes("no recipe");
        const aiMissingOrEmpty = !aiIngredients || aiIngredients.length === 0;
        const genericFallback = ["salt", "pepper", "olive oil"];
        const aiLooksGeneric = Array.isArray(aiIngredients)
            ? aiIngredients.length > 0 &&
              aiIngredients.every((s) =>
                  genericFallback.includes(String(s).toLowerCase())
              )
            : false;
        const isUnknownRecipe =
            (aiMissingOrEmpty || aiLooksGeneric || titleLooksUnknown) &&
            !recipeMap[keyCheck];
        if (isUnknownRecipe) {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: `Sorry, I couldn't find a recipe for "${text}". Please try another dish or rephrase (e.g., "recipe for lasagna").`,
                },
            ]);
            setPendingVariation(null);
            setTyping(false);
            return;
        }

        const detectBaseDish = (userText, aiTitleText, aiIngs) => {
            const u = `${userText || ""}`.toLowerCase();
            const t = `${aiTitleText || ""}`.toLowerCase();
            const specifiedKeywords = [
                "chicken",
                "beef",
                "tuna",
                "tofu",
                "vegetarian",
                "jam",
                "chocolate",
                "plain",
                "lamb",
                "prawn",
                "shrimp",
                "prawns",
            ];
            const userSpecified = specifiedKeywords.some((k) => u.includes(k));
            const s = `${u} ${t}`;
            if (!userSpecified && s.includes("salad")) return "salad";
            if (s.includes("lasagna") || s.includes("lasagne"))
                return "lasagna";
            if (
                !userSpecified &&
                (s.includes("pancake") || s.includes("pancakes"))
            )
                return "pancakes";
            if (!userSpecified && s.includes("curry")) return "curry";
            if (!userSpecified && Array.isArray(aiIngs)) {
                const low = aiIngs.map((x) => String(x).toLowerCase());
                const looksLikeSalad = ["lettuce", "cucumber"].every((k) =>
                    low.find((v) => v.includes(k))
                );
                if (looksLikeSalad) return "salad";
            }
            return null;
        };

        const baseDish = detectBaseDish(text, title, aiIngredients);

        // If user provided ingredients in the prompt (e.g., "I have carrots, onions and chickpeas"), persist them for follow-ups
        const extractIngredientsFromText = (t) => {
            if (!t) return null;
            const m =
                t.match(/\bi have\s+([^.?]+)/i) ||
                t.match(/\bwith\s+([^.?]+)/i) ||
                t.match(/\busing\s+([^.?]+)/i);
            if (!m || !m[1]) return null;
            const raw = m[1]
                .replace(/\band\b/gi, ",")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            return raw.length >= 2 ? raw : null;
        };
        const parsedIngs = extractIngredientsFromText(text);
        if (parsedIngs) {
            ingredientContextRef.current = parsedIngs;
        } else if (
            altIntent &&
            Array.isArray(aiIngredients) &&
            aiIngredients.length
        ) {
            // If this was an alternate suggestion, keep using the AI's ingredients as the current context
            ingredientContextRef.current = aiIngredients;
        }

        const determineVariations = (base, baseTitle, baseIngredients) => {
            if (!base) return null;
            if (base === "salad") {
                return {
                    title: baseTitle,
                    baseIngredients,
                    baseDish: base,
                    question: "How would you like your salad?",
                    options: [
                        {key: "vegetarian", label: "Vegetarian"},
                        {key: "chicken", label: "Chicken"},
                        {key: "tuna", label: "Tuna"},
                        {key: "tofu", label: "Tofu"},
                        {key: "classic", label: "Classic"},
                    ],
                };
            }
            if (base === "lasagna") {
                return {
                    title: baseTitle,
                    baseIngredients,
                    baseDish: base,
                    question: "Choose a lasagna variation:",
                    options: [
                        {key: "beef", label: "Beef"},
                        {key: "vegetarian", label: "Vegetarian"},
                        {key: "classic", label: "Classic"},
                    ],
                };
            }
            if (base === "pancakes") {
                return {
                    title: baseTitle,
                    baseIngredients,
                    baseDish: base,
                    question: "Choose a pancakes variation:",
                    options: [
                        {key: "plain", label: "Plain"},
                        {key: "jam", label: "Jam"},
                        {key: "chocolate", label: "Chocolate"},
                    ],
                };
            }
            if (base === "curry") {
                return {
                    title: baseTitle,
                    baseIngredients,
                    baseDish: base,
                    question: "Which curry variation would you like?",
                    options: [
                        {key: "chicken", label: "Chicken"},
                        {key: "beef", label: "Beef"},
                        {key: "lamb", label: "Lamb"},
                        {key: "prawn", label: "Prawn"},
                        {key: "vegetarian", label: "Vegetarian"},
                        {key: "tofu", label: "Tofu"},
                        {key: "classic", label: "Classic"},
                    ],
                };
            }
            return null;
        };

        if (apiVariations && apiVariations.length && baseDish) {
            const normalizedOptions = apiVariations.map((it) => {
                if (typeof it === "string")
                    return {key: it.toLowerCase(), label: it};
                const key = (
                    it?.key ||
                    it?.id ||
                    it?.label ||
                    it?.name ||
                    ""
                ).toString();
                const label = (
                    it?.label ||
                    it?.name ||
                    it?.title ||
                    key
                ).toString();
                return {key: key.toLowerCase(), label};
            });
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: `${
                        apiVariationQuestion || "Choose a variation:"
                    } ${normalizedOptions.map((o) => o.label).join(", ")}`,
                },
            ]);
            setPendingVariation({
                title: normalizedTitle,
                baseIngredients: ingredients,
                baseDish,
                question: apiVariationQuestion || "Choose a variation:",
                options: normalizedOptions,
                source: "api",
            });
            setTyping(false);
            return;
        }

        const variations = determineVariations(
            baseDish,
            normalizedTitle,
            ingredients
        );
        if (variations) {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: `${variations.question} ${variations.options
                        .map((o) => o.label)
                        .join(", ")}`,
                },
            ]);
            setPendingVariation(variations);
            setTyping(false);
            return;
        }

        const reply = `For ${normalizedTitle}, you'll need: \n- ${ingredients.join(
            "\n- "
        )}\n\nEdit the list below and confirm when ready.`;
        setMessages((prev) => [...prev, {role: "assistant", text: reply}]);
        setPendingVariation(null);
        setPendingRecipe({title: normalizedTitle, ingredients});
        setTyping(false);
    };

    const handleSelectVariation = useCallback(
        async (opt) => {
            if (!pendingVariation) return;
            const baseTitle = pendingVariation.title;
            const baseIngredients = pendingVariation.baseIngredients || [];
            const lower = (s) => (s || "").toLowerCase();
            const has = (arr, item) =>
                arr.some((x) => lower(x) === lower(item));
            const addUnique = (arr, items) => {
                const next = [...arr];
                for (const it of items) {
                    if (!has(next, it)) next.push(it);
                }
                return next;
            };
            let outTitle = baseTitle;
            let outIngredients = [...baseIngredients];
            const base =
                pendingVariation?.baseDish || lower(baseTitle).split(" ")[0];

            if (pendingVariation?.source === "api") {
                try {
                    setTyping(true);
                    const resp = await fetch("/api/ai/recipes", {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({
                            query: lastQueryRef.current || baseTitle,
                            variationKey: opt,
                            baseDish: base,
                        }),
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        const title = (data?.title || baseTitle).toString();
                        const ings = Array.isArray(data?.ingredients)
                            ? data.ingredients
                                  .map((s) => String(s || "").trim())
                                  .filter(Boolean)
                            : outIngredients;
                        const reply = `For ${title}, you'll need: \n- ${ings.join(
                            "\n- "
                        )}\n\nEdit the list below and confirm when ready.`;
                        setMessages((prev) => [
                            ...prev,
                            {role: "assistant", text: reply},
                        ]);
                        setPendingRecipe({title, ingredients: ings});
                        setPendingVariation(null);
                        setTyping(false);
                        return;
                    }
                } catch {}
                setTyping(false);
                // fall back to client variation handling below
            }
            if (base === "salad") {
                if (opt === "vegetarian") {
                    outTitle = "Vegetarian Salad";
                    outIngredients = addUnique(outIngredients, [
                        "Chickpeas",
                        "Feta",
                    ]);
                } else if (opt === "chicken") {
                    outTitle = "Chicken Salad";
                    outIngredients = addUnique(outIngredients, [
                        "Chicken breast",
                    ]);
                } else if (opt === "tuna") {
                    outTitle = "Tuna Salad";
                    outIngredients = addUnique(outIngredients, ["Tuna"]);
                } else if (opt === "tofu") {
                    outTitle = "Tofu Salad";
                    outIngredients = addUnique(outIngredients, ["Tofu"]);
                } else {
                    outTitle = baseTitle;
                }
            } else if (base === "lasagna") {
                const replaceMeat = (to) => {
                    const idx = outIngredients.findIndex(
                        (x) => lower(x) === "ground beef"
                    );
                    if (idx >= 0) {
                        outIngredients[idx] = to;
                    } else {
                        outIngredients = addUnique(outIngredients, [to]);
                    }
                };
                if (opt === "beef" || opt === "classic") {
                    outTitle = "Beef Lasagna";
                    replaceMeat("Ground beef");
                } else if (opt === "vegetarian") {
                    outTitle = "Vegetarian Lasagna";
                    outIngredients = outIngredients.filter(
                        (x) => lower(x) !== "ground beef"
                    );
                    outIngredients = addUnique(outIngredients, [
                        "Spinach",
                        "Mushrooms",
                    ]);
                }
            } else if (base === "pancakes") {
                if (opt === "plain") {
                    outTitle = "Plain Pancakes";
                } else if (opt === "jam") {
                    outTitle = "Pancakes with Jam";
                    outIngredients = addUnique(outIngredients, ["Jam"]);
                } else if (opt === "chocolate") {
                    outTitle = "Chocolate Pancakes";
                    outIngredients = addUnique(outIngredients, [
                        "Chocolate chips",
                    ]);
                }
            } else if (base === "curry") {
                const proteins = {
                    chicken: "Chicken",
                    beef: "Beef",
                    lamb: "Lamb",
                    prawn: "Prawns",
                    tofu: "Tofu",
                };
                if (opt in proteins) {
                    const p = proteins[opt];
                    outTitle = `${p} Curry`;
                    outIngredients = addUnique(outIngredients, [p]);
                } else if (opt === "vegetarian" || opt === "classic") {
                    outTitle = opt === "classic" ? "Curry" : "Vegetarian Curry";
                    outIngredients = outIngredients.filter(
                        (x) =>
                            ![
                                "chicken",
                                "beef",
                                "lamb",
                                "prawn",
                                "prawns",
                            ].includes(lower(x))
                    );
                    if (opt === "vegetarian") {
                        outIngredients = addUnique(outIngredients, [
                            "Potatoes",
                            "Cauliflower",
                        ]);
                    }
                }
            }
            const reply = `For ${outTitle}, you'll need: \n- ${outIngredients.join(
                "\n- "
            )}\n\nEdit the list below and confirm when ready.`;
            setMessages((prev) => [...prev, {role: "assistant", text: reply}]);
            setPendingRecipe({title: outTitle, ingredients: outIngredients});
            setPendingVariation(null);
        },
        [pendingVariation]
    );

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

    const handleCreateNewListAndAdd = async () => {
        if (!pendingRecipe) return;
        setLoading(true);
        try {
            if (!userData?.id || !token) {
                showNotification("Sign in to create a list", "error");
                return;
            }
            // Always create a fresh list for this action
            const targetListId = await ensureListForHome();
            if (!targetListId) {
                showNotification("Failed to create list", "error");
                return;
            }

            try {
                window.dispatchEvent(new CustomEvent("lista:ai-adding-start"));
            } catch {}

            const toAdd = editedIngredients?.length
                ? editedIngredients.filter((s) => !!s && s.trim() !== "")
                : pendingRecipe.ingredients;
            for (const ing of toAdd) {
                await addItemToList(targetListId, ing);
            }

            showNotification(
                "New list created and ingredients added",
                "success",
                1200
            );
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: "Created a new list and added the ingredients.",
                },
            ]);
            setLastRecipe({title: pendingRecipe.title, ingredients: toAdd});
            setPendingRecipe(null);
        } finally {
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
                        setMounted(true);
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

            {mounted && (
                <div
                    ref={panelRef}
                    className="fixed right-4 sm:right-6 bottom-6 z-[9999] max-w-[350px] sm:w-[380px] max-h-[75vh] sm:max-h-[70vh] rounded-md border bg-white dark:bg-black dark:text-white shadow-2xl overflow-hidden flex flex-col"
                >
                    <div className="flex items-center justify-between px-3 py-2 border-b dark:border-gray-700 shrink-0">
                        <div className="font-bold">Recipe Assistant</div>
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

                        {typing && (
                            <div className="text-left">
                                <span className="inline-block px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800">
                                    Assistant is thinking…
                                </span>
                            </div>
                        )}

                        {pendingVariation && (
                            <div className="mt-3 space-y-2">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {pendingVariation.question}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {pendingVariation.options.map((o) => (
                                        <button
                                            key={o.key}
                                            type="button"
                                            onClick={() =>
                                                handleSelectVariation(o.key)
                                            }
                                            className="px-3 py-1 rounded cursor-pointer border dark:border-gray-700 text-sm"
                                        >
                                            {o.label}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPendingVariation(null)
                                        }
                                        className="px-3 py-1 rounded cursor-pointer border dark:border-gray-700 text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

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
                                        className="px-3 py-1 rounded cursor-pointer bg-blue-600 text-white disabled:opacity-50"
                                    >
                                        {loading ? "Adding..." : "Add"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingRecipe(true)}
                                        className="px-3 py-1 rounded cursor-pointer border dark:border-gray-700"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        disabled={loading}
                                        onClick={handleCancel}
                                        className="px-3 py-1 rounded cursor-pointer border dark:border-gray-700"
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
                                                ref={(el) =>
                                                    (ingredientInputRefs.current[
                                                        idx
                                                    ] = el)
                                                }
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
                                                className="px-2 py-1 rounded cursor-pointer border dark:border-gray-700 text-sm"
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
                                            setEditedIngredients((prev) => {
                                                const next = [...prev, ""];
                                                setFocusIndex(next.length - 1);
                                                return next;
                                            })
                                        }
                                        className="px-3 py-1 rounded cursor-pointer border dark:border-gray-700"
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
                                        className="px-3 py-1 rounded cursor-pointer border dark:border-gray-700"
                                    >
                                        Reset
                                    </button>
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button
                                        disabled={loading}
                                        onClick={handleConfirmAdd}
                                        className="px-3 py-1 rounded cursor-pointer bg-blue-600 text-white disabled:opacity-50"
                                    >
                                        {loading ? "Adding..." : "Add to list"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingRecipe(false)}
                                        className="px-3 py-1 rounded cursor-pointer border dark:border-gray-700"
                                    >
                                        Back
                                    </button>
                                    <button
                                        disabled={loading}
                                        onClick={handleCancel}
                                        className="px-3 py-1 rounded cursor-pointer border dark:border-gray-700"
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

                        {!pendingRecipe &&
                            !pendingVariation &&
                            !typing &&
                            !loading && (
                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const ex = "I plan to make lasagna";
                                            setInput(ex);
                                            setTimeout(() => handleSubmit(), 0);
                                        }}
                                        className="px-2 py-1 rounded border dark:border-gray-700"
                                    >
                                        Try: Lasagna
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const ex = "Recipe for pancakes";
                                            setInput(ex);
                                            setTimeout(() => handleSubmit(), 0);
                                        }}
                                        className="px-2 py-1 rounded border dark:border-gray-700"
                                    >
                                        Try: Pancakes
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const ex = "I'm cooking salad";
                                            setInput(ex);
                                            setTimeout(() => handleSubmit(), 0);
                                        }}
                                        className="px-2 py-1 rounded border dark:border-gray-700"
                                    >
                                        Try: Salad
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
                            disabled={typing || loading}
                            className="flex-1 rounded-md border dark:border-gray-700 px-3 py-2 bg-white dark:bg-black disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={typing || loading}
                            className="px-3 py-2 cursor-pointer rounded-md bg-blue-600 text-white disabled:opacity-50"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
