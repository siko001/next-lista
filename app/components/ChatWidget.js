"use client";
import {
  useCallback,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { gsap } from "gsap";
import { useUserContext } from "../contexts/UserContext";
import { useListContext } from "../contexts/ListContext";
import { useNotificationContext } from "../contexts/NotificationContext";
import { decryptToken, WP_API_BASE, decodeHtmlEntities, getAllProducts, getAllCustomProducts } from "../lib/helpers";
import {invalidateListData, invalidateCache, cacheKeys} from "../lib/dataCache.mjs";
import {
  LIST_NAME_MAX_LENGTH,
  INGREDIENT_NAME_MAX_LENGTH,
} from "../lib/config";
import VoiceListInput from "./VoiceListInput";
import AssistantMessage from "./AssistantMessage";
import {runAssistantAddJob} from "../lib/assistantAddJobs";
import { History, MessageCircle, Mic, SquarePen, X } from "lucide-react";

const INITIAL_MESSAGE = {
  role: "assistant",
  text: "Hi! Tell me what you're in the mood to cook, ask for ideas, or tell me what to add to your list.",
};

const ChatWidget = forwardRef(function ChatWidget(
  { context = "home", listId: propListId, token: propToken },
  ref,
) {
  const { userData, token: ctxToken } = useUserContext();
  const { createShoppingList, getShoppingList, userLists } = useListContext();
  const { showNotification } = useNotificationContext();

  const [open, setOpen] = useState(false);
  const [resumePrompt, setResumePrompt] = useState(false);
  const [voiceHasDraft, setVoiceHasDraft] = useState(false);
  const [voiceResetVersion, setVoiceResetVersion] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const wasOpenRef = useRef(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
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

  // Direct add functionality states
  const [pendingDirectAdd, setPendingDirectAdd] = useState(null);
  const [listSelectionMode, setListSelectionMode] = useState(null); // 'existing' | 'new'
  const [availableLists, setAvailableLists] = useState([]);
  const [awaitingNewListName, setAwaitingNewListName] = useState(false);

  const token = propToken || ctxToken;
  const storageKey = userData?.id
    ? `lista:assistant:${userData.id}:${context}:${propListId || "home"}`
    : null;
  const handleVoiceDraftChange = useCallback(
    (hasDraft) => setVoiceHasDraft(hasDraft),
    [],
  );

  // Expose openWidget method to parent via ref
  useImperativeHandle(ref, () => ({
    openWidget: () => {
      setOpen(true);
      setMounted(true);
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          inputRef.current?.focus?.();
        });
      }
    },
  }));

  // Auto-scroll to bottom on new messages/open/editor changes
  useEffect(() => {
    if (!open) return;
    const el = messagesContainerRef.current;
    if (el) {
      // scroll after layout with smooth behavior
      requestAnimationFrame(() => {
        try {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        } catch {
          el.scrollTop = el.scrollHeight;
        }
      });
    }
  }, [messages, open, activeTab, editedIngredients, pendingRecipe]);

  // Keep the panel at its final height while animating it in and out.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    gsap.killTweensOf(el);
    if (open) {
      gsap.set(el, {
        visibility: "visible",
        opacity: 0,
        y: 24,
        scale: 0.96,
        transformOrigin: "bottom right",
      });
      gsap.to(el, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: prefersReduced ? 0 : 0.28,
        ease: "power2.out",
      });
    } else if (mounted) {
      gsap.to(el, {
        opacity: 0,
        y: 24,
        scale: 0.96,
        duration: prefersReduced ? 0 : 0.2,
        ease: "power2.in",
        onComplete: () => gsap.set(el, { visibility: "hidden" }),
      });
    }
  }, [open, mounted]);

  // Close on Escape or outside click when open
  useEffect(() => {
    if (!mounted || !open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onClickOutside = (e) => {
      const el = panelRef.current;
      if (!el) return;
      if (!el.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    // mousedown to fire before focus shifts
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [mounted, open]);

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

  // Auto-focus input when awaiting new list name
  useEffect(() => {
    if (awaitingNewListName && open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus?.();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [awaitingNewListName, open]);

  // Helper function to validate and filter ingredients by length
  const validateIngredients = (ingredients) => {
    const valid = [];
    const invalid = [];

    ingredients.forEach((ing) => {
      const trimmed = ing.trim();
      if (trimmed.length === 0) {
        return;
      }
      if (trimmed.length > INGREDIENT_NAME_MAX_LENGTH) {
        invalid.push({
          original: trimmed,
          suggested: trimmed.slice(0, INGREDIENT_NAME_MAX_LENGTH),
          length: trimmed.length,
        });
      } else {
        valid.push(trimmed);
      }
    });

    return { valid, invalid };
  };

  // Only show Re-add after user empties the list (list context)
  useEffect(() => {
    if (context !== "list") return;
    const handler = (e) => {
      const { listId: evtListId } = e?.detail || {};
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
  const productsCacheRef = useRef({ all: null, custom: null });

  const handleSubmit = async (e, overrideText = null) => {
    e?.preventDefault?.();
    const text = (overrideText || input).trim();
    if (!text) return;
    if (typing || loading) return;

    // Handle "add to {listname}: {ingredients}" pattern
    const addToMatch = text.match(/^add\s+to\s+([^:]+):\s*(.+)$/i);
    if (addToMatch) {
      const listName = addToMatch[1].trim();
      const ingredientsStr = addToMatch[2].trim();

      if (!ingredientsStr) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Please specify ingredients after the colon.",
          },
        ]);
        return;
      }

      const ingredients = ingredientsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (ingredients.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Please provide at least one ingredient.",
          },
        ]);
        return;
      }

      // Validate ingredient lengths
      const { valid, invalid } = validateIngredients(ingredients);
      const finalIngredients = valid.concat(invalid.map((i) => i.suggested));

      if (invalid.length > 0) {
        const warnings = invalid
          .map(
            (item) =>
              `"${item.original}" (${item.length} chars, max ${INGREDIENT_NAME_MAX_LENGTH})`,
          )
          .join(", ");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Some ingredients were too long and were truncated: ${warnings}`,
          },
        ]);
      }

      setMessages((prev) => [...prev, { role: "user", text }]);
      setInput("");

      // Search for the list
      await handleAddToNamedList(listName, finalIngredients);
      return;
    }

    // Handle "create {listname} and add {ingredients}" pattern
    const createAndAddMatch = text.match(
      /^create\s+(.+?)\s+and\s+add\s+(.+)$/i,
    );
    if (createAndAddMatch) {
      const listName = createAndAddMatch[1].trim();
      const ingredientsStr = createAndAddMatch[2].trim();

      if (!listName || !ingredientsStr) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Please specify both list name and ingredients.",
          },
        ]);
        return;
      }

      const ingredients = ingredientsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (ingredients.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Please provide at least one ingredient.",
          },
        ]);
        return;
      }

      // Validate ingredient lengths
      const { valid, invalid } = validateIngredients(ingredients);
      const finalIngredients = valid.concat(invalid.map((i) => i.suggested));

      if (invalid.length > 0) {
        const warnings = invalid
          .map(
            (item) =>
              `"${item.original}" (${item.length} chars, max ${INGREDIENT_NAME_MAX_LENGTH})`,
          )
          .join(", ");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Some ingredients were too long and were truncated: ${warnings}`,
          },
        ]);
      }

      setMessages((prev) => [...prev, { role: "user", text }]);
      setInput("");

      // Create list and add ingredients
      await handleCreateListAndAddNamed(listName, finalIngredients);
      return;
    }

    // Handle "add {ingredients} in {listname}" pattern
    const addInMatch = text.match(/^add\s+(.+?)\s+in\s+(.+)$/i);
    if (addInMatch) {
      const ingredientsStr = addInMatch[1].trim();
      const listName = addInMatch[2].trim();

      if (!listName || !ingredientsStr) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Please specify both list name and ingredients.",
          },
        ]);
        return;
      }

      const ingredients = ingredientsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (ingredients.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Please provide at least one ingredient.",
          },
        ]);
        return;
      }

      // Validate ingredient lengths
      const { valid, invalid } = validateIngredients(ingredients);
      const finalIngredients = valid.concat(invalid.map((i) => i.suggested));

      if (invalid.length > 0) {
        const warnings = invalid
          .map(
            (item) =>
              `"${item.original}" (${item.length} chars, max ${INGREDIENT_NAME_MAX_LENGTH})`,
          )
          .join(", ");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Some ingredients were too long and were truncated: ${warnings}`,
          },
        ]);
      }

      setMessages((prev) => [...prev, { role: "user", text }]);
      setInput("");

      // Search for the list and add ingredients
      await handleAddToNamedList(listName, finalIngredients);
      return;
    }

    // Handle "add:" or "add " pattern for direct ingredient addition
    const addMatch = text.match(/^add(?:\s+|:)\s*(.+)$/i);
    if (addMatch) {
      const ingredientsStr = addMatch[1];
      if (!ingredientsStr) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Please specify ingredients. For example: 'add: flour, milk, eggs'",
          },
        ]);
        return;
      }

      // Parse ingredients
      const ingredients = ingredientsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (ingredients.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Please provide at least one ingredient.",
          },
        ]);
        return;
      }

      // Validate ingredient lengths
      const { valid, invalid } = validateIngredients(ingredients);

      if (invalid.length > 0) {
        const warnings = invalid
          .map(
            (item) =>
              `"${item.original}" (${item.length} chars, max ${INGREDIENT_NAME_MAX_LENGTH})`,
          )
          .join(", ");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Some ingredients are too long: ${warnings}. They will be added with truncated names or you can re-enter with shorter names.`,
          },
        ]);
        // Still proceed with valid ingredients, but use suggested names for invalid ones
        const allIngredients = valid.concat(invalid.map((i) => i.suggested));
        setPendingDirectAdd(allIngredients);
      } else {
        setPendingDirectAdd(valid);
      }
      setAwaitingNewListName(false);

      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          text: `add: ${ingredientsStr}`,
        },
        {
          role: "assistant",
          text: `Got it! I found ${ingredients.length} ingredient${
            ingredients.length > 1 ? "s" : ""
          } to add. Where would you like to add them?`,
        },
      ]);
      setInput("");
      return;
    }

    // Handle new list name input
    if (awaitingNewListName && listSelectionMode === "new") {
      const listName = text.trim();
      if (!listName) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Please provide a list name.",
          },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { role: "user", text: listName }]);
      setInput("");

      // Create the new list and add ingredients
      await handleCreateListAndAdd(listName);
      setAwaitingNewListName(false);
      setListSelectionMode(null);
      setPendingDirectAdd(null);
      return;
    }

    // Handle list name too long - waiting for new name
    if (pendingListNameTooLong) {
      const listName = text.trim();
      if (!listName) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Please provide a list name (up to ${LIST_NAME_MAX_LENGTH} characters).`,
          },
        ]);
        return;
      }

      // Check if still too long
      if (listName.length > LIST_NAME_MAX_LENGTH) {
        const suggestedName = listName.slice(0, LIST_NAME_MAX_LENGTH);
        setMessages((prev) => [
          ...prev,
          {
            role: "user",
            text: listName,
          },
          {
            role: "assistant",
            text: `That name is still too long (${listName.length} characters). Maximum is ${LIST_NAME_MAX_LENGTH} characters.`,
          },
        ]);
        setInput("");
        setPendingListNameTooLong({
          ...pendingListNameTooLong,
          suggestedName,
        });
        return;
      }

      setMessages((prev) => [...prev, { role: "user", text: listName }]);
      setInput("");

      // Use the new name with the stored ingredients
      const { ingredients } = pendingListNameTooLong;
      setPendingListNameTooLong(null);
      await handleCreateListAndAddNamed(listName, ingredients);
      return;
    }

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    lastQueryRef.current = text;

    if (pendingVariation) {
      const lower = text.toLowerCase().trim();
      const options = pendingVariation.options || [];
      const norm = (s) => (s || "").toString().toLowerCase().trim();
      const lev = (a, b) => {
        const m = a.length,
          n = b.length;
        const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
          for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
              dp[i - 1][j] + 1,
              dp[i][j - 1] + 1,
              dp[i - 1][j - 1] + cost,
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
          Math.floor(Math.min(k.length, l.length) * 0.4),
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
        lowerText,
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
      const isBurgerLike = /burger|cheeseburger|sandwich|wrap/.test(baseTitle);

      if (isBurgerLike && /\bfries?\b/.test(lower)) {
        const toAdd = ["Potatoes", "Oil"];
        setEditedIngredients((prev) => {
          const seed =
            prev && prev.length ? prev : pendingRecipe?.ingredients || [];
          const exists = (arr, item) =>
            arr.some((x) => (x || "").toLowerCase() === item.toLowerCase());
          const next = [...seed];
          for (const it of toAdd) if (!exists(next, it)) next.push(it);
          return next;
        });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Added: Fries (Potatoes, Oil)" },
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
          prev.filter((x) => x.toLowerCase() !== item),
        );
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `Removed: ${item}` },
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
          { role: "assistant", text: `Added: ${item}` },
        ]);
        return;
      }
      if (replaceMatch) {
        const from = replaceMatch[1].trim();
        const to = replaceMatch[2].trim();
        setEditedIngredients((prev) => {
          const idx = prev.findIndex(
            (x) => x.toLowerCase() === from.toLowerCase(),
          );
          if (idx === -1) return prev;
          const copy = [...prev];
          copy[idx] = to;
          return copy;
        });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `Replaced ${from} with ${to}` },
        ]);
        return;
      }
    }

    setTyping(true);
    let finalQuery = text;
    if (altIntent && Array.isArray(ingredientContextRef.current) && ingredientContextRef.current.length) {
      finalQuery = `${text} (Earlier ingredients: ${ingredientContextRef.current.join(", ")})`;
    }
    try {
      const resp = await fetch("/api/ai/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: finalQuery, history: messages.slice(-10) }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "The assistant is temporarily unavailable.");

      const assistantMessage = {
        role: "assistant",
        text: data.message || (data.kind === "recipe" ? `Here's a plan for ${data.title}.` : "How can I help?"),
        recipe: data.kind === "recipe" ? {
          title: data.title,
          ingredients: data.ingredients,
          steps: data.steps || [],
        } : null,
        suggestions: data.suggestions || [],
        links: data.links || [],
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setPendingVariation(null);
      if (data.kind === "recipe") {
        setPendingRecipe({ title: data.title, ingredients: data.ingredients });
        ingredientContextRef.current = data.ingredients;
      }
    } catch (error) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        text: error?.message || "I couldn't reach the assistant just now. Please try again.",
      }]);
    } finally {
      setTyping(false);
    }
  };

  const handleSelectVariation = useCallback(
    async (opt) => {
      if (!pendingVariation) return;
      const baseTitle = pendingVariation.title;
      const baseIngredients = pendingVariation.baseIngredients || [];
      const lower = (s) => (s || "").toLowerCase();
      const has = (arr, item) => arr.some((x) => lower(x) === lower(item));
      const addUnique = (arr, items) => {
        const next = [...arr];
        for (const it of items) {
          if (!has(next, it)) next.push(it);
        }
        return next;
      };
      let outTitle = baseTitle;
      let outIngredients = [...baseIngredients];
      const base = pendingVariation?.baseDish || lower(baseTitle).split(" ")[0];

      if (pendingVariation?.source === "api") {
        try {
          setTyping(true);
          const resp = await fetch("/api/ai/recipes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
              "\n- ",
            )}\n\nEdit the list below and confirm when ready.`;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", text: reply },
            ]);
            setPendingRecipe({ title, ingredients: ings });
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
          outIngredients = addUnique(outIngredients, ["Chickpeas", "Feta"]);
        } else if (opt === "chicken") {
          outTitle = "Chicken Salad";
          outIngredients = addUnique(outIngredients, ["Chicken breast"]);
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
            (x) => lower(x) === "ground beef",
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
            (x) => lower(x) !== "ground beef",
          );
          outIngredients = addUnique(outIngredients, ["Spinach", "Mushrooms"]);
        }
      } else if (base === "pancakes") {
        if (opt === "plain") {
          outTitle = "Plain Pancakes";
        } else if (opt === "jam") {
          outTitle = "Pancakes with Jam";
          outIngredients = addUnique(outIngredients, ["Jam"]);
        } else if (opt === "chocolate") {
          outTitle = "Chocolate Pancakes";
          outIngredients = addUnique(outIngredients, ["Chocolate chips"]);
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
              !["chicken", "beef", "lamb", "prawn", "prawns"].includes(
                lower(x),
              ),
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
        "\n- ",
      )}\n\nEdit the list below and confirm when ready.`;
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      setPendingRecipe({ title: outTitle, ingredients: outIngredients });
      setPendingVariation(null);
    },
    [pendingVariation],
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
    if (!token) throw new Error("No session is available.");
    const [all, custom] = await Promise.all([
      getAllProducts(token, {strict: true}),
      getAllCustomProducts(token),
    ]);
    if (!Array.isArray(all) || !Array.isArray(custom)) {
      throw new Error("Could not check existing products.");
    }
    productsCacheRef.current = { all, custom };
    return productsCacheRef.current;
  }, [token]);

  const resolveProductIdByTitle = useCallback(
    async (title) => {
      const pools = await loadProductPools();
      const norm = (s) => (s || "").toString().toLowerCase().trim();
      const target = norm(title);

      // Search core products first
      const core = pools.all?.find(
        (p) => norm(decodeHtmlEntities(p.title)) === target,
      );
      if (core?.id) return { id: core.id, source: "core" };

      // Then search custom products
      const custom = pools.custom?.find((p) => norm(p.title) === target);
      if (custom?.id) return { id: custom.id, source: "custom" };

      return { id: null, source: null };
    },
    [loadProductPools],
  );

  const addItemToList = useCallback(
    async (shoppingListId, title) => {
      if (!shoppingListId || !token)
        throw new Error("No list or session is available.");
      // Use decrypted token only when inside a list page (encrypted token there)
      const authToken = context === "list" ? decryptToken(token) : token;
      // 1) Try to resolve product id from existing pools
      let { id: productId } = await resolveProductIdByTitle(title);

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
              body: JSON.stringify({ title }),
            },
          );
          if (!res.ok) throw new Error("Could not create a custom product.");
          const data = await res.json();
          productId = data?.id || data?.product_id || data?.product?.id || null;

          // Update cache to include this newly created custom item
          if (productId) {
            if (userData?.id) invalidateCache(cacheKeys.customProducts(userData.id));
            const pools = productsCacheRef.current;
            if (pools?.custom) {
              pools.custom = [{ id: productId, title }, ...pools.custom];
            }
          }
        } catch (err) {
          throw err;
        }
      }

      if (!productId) throw new Error(`Could not create ${title}.`);

      try {
        const response = await fetch(
          `${WP_API_BASE}/custom/v1/update-shopping-list`,
          {
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
          },
        );
        if (!response.ok) throw new Error(`Could not add ${title}.`);
        invalidateListData(userData?.id);
        // Optimistic UI: notify list page
        try {
          const evt = new CustomEvent("lista:items-added", {
            detail: {
              listId: shoppingListId,
              items: [{ id: productId, title }],
            },
          });
          window.dispatchEvent(evt);
        } catch {}
      } catch (err) {
        throw err;
      }
    },
    [token, context, resolveProductIdByTitle, userData?.id],
  );

  const addItemsWithProgress = (targetListId, items, listName = "your list") => {
    const task = runAssistantAddJob({
      items,
      listName,
      addItem: (item) => addItemToList(targetListId, item),
    });
    setOpen(false);
    return task;
  };

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
          1200,
        );
      }

      // Announce AI bulk adding start
      try {
        window.dispatchEvent(new CustomEvent("lista:ai-adding-start"));
      } catch {}

      const toAdd = editedIngredients?.length
        ? editedIngredients.filter((s) => !!s && s.trim() !== "")
        : pendingRecipe.ingredients;
      await addItemsWithProgress(targetListId, toAdd, context === "home" ? `Items for: ${pendingRecipe.title}` : "this list");

      showNotification("Ingredients added to your list", "success", 1200);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Done! Ingredients added." },
      ]);
      setLastRecipe({ title: pendingRecipe.title, ingredients: toAdd });
      setPendingRecipe(null);
    } catch (error) {
      if (Array.isArray(error.remainingItems)) setEditedIngredients(error.remainingItems);
      showNotification(`Added ${error.completed || 0} item(s). Please retry the remaining items.`, "error");
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
      await addItemsWithProgress(targetListId, toAdd, `Items for: ${pendingRecipe.title}`);

      showNotification(
        "New list created and ingredients added",
        "success",
        1200,
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Created a new list and added the ingredients.",
        },
      ]);
      setLastRecipe({ title: pendingRecipe.title, ingredients: toAdd });
      setPendingRecipe(null);
    } catch (error) {
      showNotification(`Added ${error.completed || 0} item(s). Please check the new list before retrying.`, "error");
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
      { role: "assistant", text: "Okay, ask for another recipe anytime." },
    ]);
  };

  // State for pending list not found action
  const [pendingListNotFound, setPendingListNotFound] = useState(null);

  // State for duplicate list name confirmation
  const [pendingDuplicateList, setPendingDuplicateList] = useState(null);

  // State for list name too long
  const [pendingListNameTooLong, setPendingListNameTooLong] = useState(null);

  const [hydratedStorageKey, setHydratedStorageKey] = useState(null);
  useEffect(() => {
    if (!storageKey) return;
    try {
      for (const key of [storageKey, `${storageKey}:voice`]) {
        if (!localStorage.getItem(key) && sessionStorage.getItem(key)) {
          localStorage.setItem(key, sessionStorage.getItem(key));
        }
        sessionStorage.removeItem(key);
      }
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved === "object") {
        if (Array.isArray(saved.messages) && saved.messages.length)
          setMessages(saved.messages);
        if (typeof saved.input === "string") setInput(saved.input);
        if (saved.activeTab === "chat" || saved.activeTab === "voice")
          setActiveTab(saved.activeTab);
        setPendingRecipe(saved.pendingRecipe || null);
        setLastRecipe(saved.lastRecipe || null);
        setCanReadd(Boolean(saved.canReadd));
        setListEmptied(Boolean(saved.listEmptied));
        setPendingVariation(saved.pendingVariation || null);
        setEditedIngredients(
          Array.isArray(saved.editedIngredients) ? saved.editedIngredients : [],
        );
        setEditingRecipe(Boolean(saved.editingRecipe));
        setPendingDirectAdd(
          Array.isArray(saved.pendingDirectAdd) ? saved.pendingDirectAdd : null,
        );
        setListSelectionMode(saved.listSelectionMode || null);
        setAvailableLists(
          Array.isArray(saved.availableLists) ? saved.availableLists : [],
        );
        setAwaitingNewListName(Boolean(saved.awaitingNewListName));
        setPendingListNotFound(saved.pendingListNotFound || null);
        setPendingDuplicateList(saved.pendingDuplicateList || null);
        setPendingListNameTooLong(saved.pendingListNameTooLong || null);
      }
      const hasVoiceDraft = Boolean(
        localStorage.getItem(`${storageKey}:voice`),
      );
      setVoiceHasDraft(hasVoiceDraft);
      if (saved || hasVoiceDraft) setResumePrompt(true);
      const history = JSON.parse(localStorage.getItem(`${storageKey}:history`) || "[]");
      setConversationHistory(Array.isArray(history) ? history : []);
    } catch {
      // A damaged browser draft should not prevent the assistant from opening.
    }
    setHydratedStorageKey(storageKey);
  }, [storageKey]);

  const hasChatProgress =
    messages.length > 1 ||
    Boolean(input.trim()) ||
    Boolean(
      pendingRecipe ||
      pendingVariation ||
      pendingDirectAdd ||
      pendingListNotFound ||
      pendingDuplicateList ||
      pendingListNameTooLong ||
      awaitingNewListName,
    );
  const hasConversation = hasChatProgress || voiceHasDraft;

  useEffect(() => {
    if (!storageKey || hydratedStorageKey !== storageKey) return;
    try {
      if (!hasChatProgress) {
        localStorage.removeItem(storageKey);
        return;
      }
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          messages,
          input,
          activeTab,
          pendingRecipe,
          lastRecipe,
          canReadd,
          listEmptied,
          pendingVariation,
          editedIngredients,
          editingRecipe,
          pendingDirectAdd,
          listSelectionMode,
          availableLists,
          awaitingNewListName,
          pendingListNotFound,
          pendingDuplicateList,
          pendingListNameTooLong,
        }),
      );
    } catch {
      // Browser storage can be unavailable or full; the mounted panel still keeps state.
    }
  }, [
    storageKey,
    hydratedStorageKey,
    hasChatProgress,
    messages,
    input,
    activeTab,
    pendingRecipe,
    lastRecipe,
    canReadd,
    listEmptied,
    pendingVariation,
    editedIngredients,
    editingRecipe,
    pendingDirectAdd,
    listSelectionMode,
    availableLists,
    awaitingNewListName,
    pendingListNotFound,
    pendingDuplicateList,
    pendingListNameTooLong,
  ]);

  useEffect(() => {
    if (open && !wasOpenRef.current) setResumePrompt(hasConversation);
    wasOpenRef.current = open;
  }, [open, hasConversation]);

  const currentChatSnapshot = () => ({
    messages,
    input,
    activeTab,
    pendingRecipe,
    lastRecipe,
    canReadd,
    listEmptied,
    pendingVariation,
    editedIngredients,
    editingRecipe,
    pendingDirectAdd,
    listSelectionMode,
    availableLists,
    awaitingNewListName,
    pendingListNotFound,
    pendingDuplicateList,
    pendingListNameTooLong,
  });

  const saveCurrentToHistory = () => {
    if (!storageKey || !hasConversation) return conversationHistory;
    let voice = null;
    try { voice = JSON.parse(localStorage.getItem(`${storageKey}:voice`) || "null"); } catch {}
    const firstUserMessage = messages.find((message) => message.role === "user")?.text;
    const title = (typeof firstUserMessage === "string" ? firstUserMessage.trim() : "") || voice?.items?.filter(Boolean).slice(0, 2).join(", ") ||
      (voiceHasDraft ? "Voice shopping list" : "Chat conversation");
    const updated = [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.slice(0, 90),
      savedAt: Date.now(),
      chat: hasChatProgress ? currentChatSnapshot() : null,
      voice,
    }, ...conversationHistory].slice(0, 20);
    try { localStorage.setItem(`${storageKey}:history`, JSON.stringify(updated)); } catch {}
    setConversationHistory(updated);
    return updated;
  };

  const resetConversation = () => {
    try {
      if (storageKey) {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`${storageKey}:voice`);
      }
    } catch {}
    setMessages([INITIAL_MESSAGE]);
    setInput("");
    setActiveTab("chat");
    setPendingRecipe(null);
    setLastRecipe(null);
    setCanReadd(false);
    setListEmptied(false);
    setPendingVariation(null);
    setEditedIngredients([]);
    setEditingRecipe(false);
    setPendingDirectAdd(null);
    setListSelectionMode(null);
    setAvailableLists([]);
    setAwaitingNewListName(false);
    setPendingListNotFound(null);
    setPendingDuplicateList(null);
    setPendingListNameTooLong(null);
    setVoiceHasDraft(false);
    setVoiceResetVersion((version) => version + 1);
    setResumePrompt(false);
    lastQueryRef.current = "";
    ingredientContextRef.current = null;
  };

  const startNewConversation = () => {
    saveCurrentToHistory();
    resetConversation();
    setShowHistory(false);
  };

  const restoreConversation = (entry) => {
    const updated = saveCurrentToHistory().filter((item) => item.id !== entry.id);
    try {
      localStorage.setItem(`${storageKey}:history`, JSON.stringify(updated));
      if (entry.voice) localStorage.setItem(`${storageKey}:voice`, JSON.stringify(entry.voice));
      else localStorage.removeItem(`${storageKey}:voice`);
      if (entry.chat) localStorage.setItem(storageKey, JSON.stringify(entry.chat));
      else localStorage.removeItem(storageKey);
    } catch {}
    setConversationHistory(updated);
    const chat = entry.chat || {};
    setMessages(Array.isArray(chat.messages) && chat.messages.length ? chat.messages : [INITIAL_MESSAGE]);
    setInput(chat.input || "");
    setActiveTab(chat.activeTab === "voice" || !entry.chat ? "voice" : "chat");
    setPendingRecipe(chat.pendingRecipe || null);
    setLastRecipe(chat.lastRecipe || null);
    setCanReadd(Boolean(chat.canReadd));
    setListEmptied(Boolean(chat.listEmptied));
    setPendingVariation(chat.pendingVariation || null);
    setEditedIngredients(Array.isArray(chat.editedIngredients) ? chat.editedIngredients : []);
    setEditingRecipe(Boolean(chat.editingRecipe));
    setPendingDirectAdd(Array.isArray(chat.pendingDirectAdd) ? chat.pendingDirectAdd : null);
    setListSelectionMode(chat.listSelectionMode || null);
    setAvailableLists(Array.isArray(chat.availableLists) ? chat.availableLists : []);
    setAwaitingNewListName(Boolean(chat.awaitingNewListName));
    setPendingListNotFound(chat.pendingListNotFound || null);
    setPendingDuplicateList(chat.pendingDuplicateList || null);
    setPendingListNameTooLong(chat.pendingListNameTooLong || null);
    setVoiceHasDraft(Boolean(entry.voice?.items?.length));
    setVoiceResetVersion((version) => version + 1);
    setResumePrompt(false);
    setShowHistory(false);
  };

  // Handle adding ingredients to a named list (search required)
  const handleAddToNamedList = async (listName, ingredients) => {
    if (!userData?.id || !token) {
      showNotification("Please sign in to use this feature", "error");
      return;
    }

    setLoading(true);
    try {
      // Decrypt token if in list context
      const authToken = context === "list" ? decryptToken(token) : token;

      // Fetch all user lists
      const fetchedLists = await getShoppingList(userData.id, authToken, {force: true});

      if (!fetchedLists || fetchedLists.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `No lists found. Would you like to create "${listName}"?`,
          },
        ]);
        setPendingListNotFound({ listName, ingredients });
        setLoading(false);
        return;
      }

      // Search for list by name (case-insensitive)
      const listTitle = (l) => l.title?.rendered || l.title || "";
      const foundList = fetchedLists.find((list) => {
        const title = listTitle(list).toLowerCase().trim();
        return title === listName.toLowerCase().trim();
      });

      if (!foundList) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `List "${listName}" not found. Would you like to create it?`,
          },
        ]);
        setPendingListNotFound({ listName, ingredients });
        setLoading(false);
        return;
      }

      // List found, add ingredients
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Found "${listName}". Adding ingredients...`,
        },
      ]);

      // Announce bulk add start
      try {
        window.dispatchEvent(new CustomEvent("lista:ai-adding-start"));
      } catch {}

      // Add each ingredient
      await addItemsWithProgress(foundList.id, ingredients, listName);

      showNotification(
        `Added ${ingredients.length} item${
          ingredients.length > 1 ? "s" : ""
        } to "${listName}"`,
        "success",
        1200,
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Done! Added to "${listName}".`,
        },
      ]);
    } catch (err) {
      console.error("Error adding to named list:", err);
      showNotification("Failed to add ingredients", "error");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, something went wrong.",
        },
      ]);
    } finally {
      try {
        window.dispatchEvent(new CustomEvent("lista:ai-adding-end"));
      } catch {}
      setLoading(false);
    }
  };

  // Handle creating a list with a specific name and ingredients
  const handleCreateListAndAddNamed = async (listName, ingredients) => {
    if (!userData?.id || !token) {
      showNotification("Please sign in to use this feature", "error");
      return;
    }

    // Check if list name is too long
    if (listName.length > LIST_NAME_MAX_LENGTH) {
      const suggestedName = listName.slice(0, LIST_NAME_MAX_LENGTH);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `List name "${listName}" is too long (${listName.length} characters). Maximum is ${LIST_NAME_MAX_LENGTH} characters.`,
        },
      ]);
      setPendingListNameTooLong({
        originalName: listName,
        suggestedName,
        ingredients,
      });
      return;
    }

    setLoading(true);
    try {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Checking if "${listName}" exists...`,
        },
      ]);

      // Decrypt token if in list context
      const authToken = context === "list" ? decryptToken(token) : token;

      // Fetch existing lists to check for duplicates
      const fetchedLists = await getShoppingList(userData.id, authToken, {force: true});

      // Check if list with same name already exists
      const listTitle = (l) => l.title?.rendered || l.title || "";
      const existingList = fetchedLists.find((list) => {
        const title = listTitle(list).toLowerCase().trim();
        return title === listName.toLowerCase().trim();
      });

      if (existingList) {
        // List already exists, warn user and wait for confirmation
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `A list named "${listName}" already exists. What would you like to do?`,
          },
        ]);
        setPendingDuplicateList({
          listName,
          ingredients,
          existingListId: existingList.id,
        });
        setLoading(false);
        return;
      }

      // No duplicate, proceed with creation
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Creating "${listName}" and adding ingredients...`,
        },
      ]);

      // Create the list
      const newListData = await createShoppingList({
        name: listName,
        userId: userData.id,
        token: authToken,
      });

      if (!newListData || !newListData.id) {
        showNotification("Failed to create list", "error");
        setLoading(false);
        return;
      }

      // Refresh lists
      await getShoppingList(userData.id, authToken);

      // Announce bulk add start
      try {
        window.dispatchEvent(new CustomEvent("lista:ai-adding-start"));
      } catch {}

      // Add each ingredient
      await addItemsWithProgress(newListData.id, ingredients, listName);

      showNotification(
        `List "${listName}" created and ingredients added`,
        "success",
        1200,
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `List "${listName}" created and ingredients added successfully!`,
        },
      ]);
    } catch (err) {
      showNotification("Failed to create list or add ingredients", "error");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, something went wrong.",
        },
      ]);
    } finally {
      try {
        window.dispatchEvent(new CustomEvent("lista:ai-adding-end"));
      } catch {}
      setLoading(false);
    }
  };

  // Handle adding to existing list when duplicate detected
  const handleAddToExistingDuplicate = async () => {
    if (!pendingDuplicateList) return;

    setLoading(true);
    try {
      const { listName, ingredients, existingListId } = pendingDuplicateList;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Adding ingredients to existing "${listName}"...`,
        },
      ]);

      // Announce bulk add start
      try {
        window.dispatchEvent(new CustomEvent("lista:ai-adding-start"));
      } catch {}

      // Add each ingredient to the existing list
      await addItemsWithProgress(existingListId, ingredients, listName);

      showNotification(
        `Added ${ingredients.length} item${
          ingredients.length > 1 ? "s" : ""
        } to "${listName}"`,
        "success",
        1200,
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Done! Added to "${listName}".`,
        },
      ]);
    } catch (err) {
      console.error("Error adding to existing list:", err);
      showNotification("Failed to add ingredients", "error");
    } finally {
      try {
        window.dispatchEvent(new CustomEvent("lista:ai-adding-end"));
      } catch {}
      setLoading(false);
      setPendingDuplicateList(null);
    }
  };

  // Handle creating new list anyway (ignoring duplicate)
  const handleCreateNewAnyway = async () => {
    if (!pendingDuplicateList) return;

    const { listName, ingredients } = pendingDuplicateList;
    setPendingDuplicateList(null);
    await handleCreateListAndAddNamed(listName, ingredients);
  };

  // Handle direct add list selection
  const handleListSelectionChoice = async (choice) => {
    if (!pendingDirectAdd || choice === "cancel") {
      setPendingDirectAdd(null);
      setListSelectionMode(null);
      setAvailableLists([]);
      setAwaitingNewListName(false);
      return;
    }

    if (choice === "new") {
      setListSelectionMode("new");
      setAwaitingNewListName(true);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Great! Please provide a name for your new list.",
        },
      ]);
      // Focus the input after a brief delay to ensure the DOM has updated
      setTimeout(() => {
        inputRef.current?.focus?.();
      }, 100);
    } else if (choice === "existing") {
      setListSelectionMode("existing");
      setTyping(true);

      try {
        // Decrypt token if in list context (same logic as addItemToList)
        const authToken = context === "list" ? decryptToken(token) : token;

        // Always fetch fresh lists from server to ensure we have the latest data
        const fetchedLists = await getShoppingList(userData.id, authToken, {force: true});

        if (fetchedLists && fetchedLists.length > 0) {
          setAvailableLists(fetchedLists);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `Please select a list (found ${
                fetchedLists.length
              } ${fetchedLists.length > 1 ? "lists" : "list"}):`,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "You don't have any lists yet. Would you like to create a new one?",
            },
          ]);
          setPendingDirectAdd(null);
          setListSelectionMode(null);
        }
      } catch (err) {
        console.error("Error fetching lists:", err);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Failed to fetch lists. Please try creating a new one.",
          },
        ]);
        setPendingDirectAdd(null);
        setListSelectionMode(null);
      } finally {
        setTyping(false);
      }
    }
  };

  const handleSelectExistingList = async (listId, listName) => {
    if (!pendingDirectAdd || !listId) return;

    setLoading(true);
    try {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Adding ingredients to "${listName}"...`,
        },
      ]);

      // Announce bulk add start
      try {
        window.dispatchEvent(new CustomEvent("lista:ai-adding-start"));
      } catch {}

      // Add each ingredient
      await addItemsWithProgress(listId, pendingDirectAdd, listName);

      showNotification(
        `Added ${pendingDirectAdd.length} item${
          pendingDirectAdd.length > 1 ? "s" : ""
        } to "${listName}"`,
        "success",
        1200,
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Done! Ingredients added successfully.",
        },
      ]);
    } catch (err) {
      showNotification("Failed to add ingredients", "error");
    } finally {
      try {
        window.dispatchEvent(new CustomEvent("lista:ai-adding-end"));
      } catch {}
      setLoading(false);
      setPendingDirectAdd(null);
      setListSelectionMode(null);
      setAvailableLists([]);
    }
  };

  const handleCreateListAndAdd = async (listName) => {
    if (!pendingDirectAdd || !userData?.id || !token) {
      showNotification("Sign in to create a list", "error");
      return;
    }

    setLoading(true);
    try {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Creating list "${listName}" and adding ingredients...`,
        },
      ]);

      // Decrypt token if in list context
      const authToken = context === "list" ? decryptToken(token) : token;

      // Create the list
      const newListData = await createShoppingList({
        name: listName,
        userId: userData.id,
        token: authToken,
      });

      if (!newListData || !newListData.id) {
        showNotification("Failed to create list", "error");
        setLoading(false);
        return;
      }

      // Refresh lists
      await getShoppingList(userData.id, authToken);

      // Announce bulk add start
      try {
        window.dispatchEvent(new CustomEvent("lista:ai-adding-start"));
      } catch {}

      // Add each ingredient
      await addItemsWithProgress(newListData.id, pendingDirectAdd, listName);

      showNotification(
        `List "${listName}" created and ingredients added`,
        "success",
        1200,
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `List "${listName}" created and ingredients added successfully!`,
        },
      ]);
    } catch (err) {
      showNotification("Failed to create list or add ingredients", "error");
    } finally {
      try {
        window.dispatchEvent(new CustomEvent("lista:ai-adding-end"));
      } catch {}
      setLoading(false);
      setPendingDirectAdd(null);
      setListSelectionMode(null);
      setAvailableLists([]);
    }
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
          className="chat-widget !duration-200 !transition-all fixed font-bold font-saira cursor-pointer bottom-6 right-6 z-40 group  rounded-full bg-blue-600 text-white px-4 py-3 shadow-lg hover:opacity-90 transition-opacity"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="size-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
            />
          </svg>
        </button>
      )}

      {mounted && (
        <div
          ref={panelRef}
          aria-hidden={!open}
          inert={!open}
          className="fixed right-3 bottom-3 sm:right-6 sm:bottom-6 z-[9999] w-[calc(100vw-1.5rem)] sm:w-[480px] lg:w-[560px] h-[min(90dvh,840px)] max-h-[calc(100dvh-1.5rem)] rounded-2xl border ai-chat ai-chat-text shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="ai-chat-header flex items-center justify-between gap-3 px-4 py-4 sm:px-5 border-b border-[var(--ai-chat-border)] shrink-0">
            <div>
              <div className="text-lg font-bold font-saira leading-tight">
                Lista Assistant
              </div>
              <p className="text-xs ai-chat-help-text">
                Plan recipes and add shopping items
              </p>
            </div>
            {conversationHistory.length > 0 && !resumePrompt && (
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                aria-label="Conversation history"
                title="Conversation history"
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ai-chat-border)] hover:bg-blue-600 hover:text-white"
              >
                <History size={18} />
              </button>
            )}
            {hasConversation && !resumePrompt && (
              <button
                type="button"
                onClick={startNewConversation}
                aria-label="New conversation"
                title="New conversation"
                className={`${conversationHistory.length ? "" : "ml-auto"} flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ai-chat-border)] hover:bg-blue-600 hover:text-white`}
              >
                <SquarePen size={18} />
              </button>
            )}
            <button
              type="button"
              aria-label="Close assistant"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ai-chat-border)] hover:bg-blue-600 hover:text-white"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Assistant modes"
            className="ai-chat-tabs grid grid-cols-2 gap-2 px-4 py-3 sm:px-5 border-b border-[var(--ai-chat-border)] shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "chat"}
              onClick={() => setActiveTab("chat")}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-bold ${activeTab === "chat" ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-[var(--ai-chat-border)] hover:bg-blue-600 hover:text-white"}`}
            >
              <MessageCircle size={17} /> Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "voice"}
              onClick={() => setActiveTab("voice")}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-bold ${activeTab === "voice" ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-[var(--ai-chat-border)] hover:bg-blue-600 hover:text-white"}`}
            >
              <Mic size={17} /> Voice
            </button>
          </div>

          <div
            className={`${activeTab === "chat" ? "flex" : "hidden"} min-h-0 flex-1 flex-col`}
            role="tabpanel"
            aria-label="Chat assistant"
          >
            <div
              ref={messagesContainerRef}
              id="lista-chat-scroll"
              data-lenis-prevent
              data-scroll-lock-scrollable
              className="ai-chat-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 text-[15px] leading-relaxed"
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
                  className={m.role === "user" ? "text-right" : "text-left"}
                >
                  <div
                    className={`inline-block max-w-[92%] break-words px-4 py-3 rounded-2xl ${
                      m.role === "user"
                        ? "bg-blue-600 text-white"
                        : "ai-chat-message-bg"
                    }`}
                  >
                    <AssistantMessage message={m} onSuggestion={(suggestion) => handleSubmit(null, suggestion)} onMoreIdeas={() => handleSubmit(null, "More ideas, please. Keep the same preferences and suggest different dishes from the ones you just mentioned.")} />
                  </div>
                </div>
              ))}

              {typing && (
                <div className="text-left">
                  <span className="inline-block font-quicksand font-black px-3 py-2 rounded-md ai-chat-message-bg">
                    Assistant is thinking…
                  </span>
                </div>
              )}

              {pendingVariation && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs ai-chat-help-text">
                    {pendingVariation.question}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pendingVariation.options.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => handleSelectVariation(o.key)}
                        className="px-3 py-1  font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm ai-chat-button"
                      >
                        {o.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPendingVariation(null)}
                      className="px-3 py-1 text-red-500  font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm ai-chat-button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {pendingRecipe && !editingRecipe && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs  font-quicksand font-black ai-chat-help-text">
                    Ready to add ingredients for: {pendingRecipe.title}
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={loading}
                      onClick={handleConfirmAdd}
                      className="px-3 py-1 rounded cursor-pointer bg-blue-600 text-white disabled:opacity-50 ai-chat-button-blue"
                    >
                      {loading ? "Adding..." : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingRecipe(true)}
                      className="px-3 py-1  font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] ai-chat-button"
                    >
                      Edit
                    </button>
                    <button
                      disabled={loading}
                      onClick={handleCancel}
                      className="px-3 py-1 text-red-500  font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] ai-chat-button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {pendingRecipe && editingRecipe && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs ai-chat-help-text">
                    Editing ingredients for: {pendingRecipe.title}
                  </div>

                  <div className="space-y-2">
                    {editedIngredients.map((ing, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={ing}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditedIngredients((prev) => {
                              const copy = [...prev];
                              copy[idx] = v;
                              return copy;
                            });
                          }}
                          ref={(el) => (ingredientInputRefs.current[idx] = el)}
                          className="flex-1 rounded-md border border-[var(--ai-chat-border)] px-2 py-1 ai-chat-input text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditedIngredients((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          className="px-2 py-1  font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm ai-chat-button"
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
                      className="px-3 py-1  font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] ai-chat-button"
                    >
                      + Add item
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditedIngredients([
                          ...(pendingRecipe?.ingredients || []),
                        ])
                      }
                      className="px-3 py-1  font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] ai-chat-button"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={loading}
                      onClick={handleConfirmAdd}
                      className="px-3 py-1 font-quicksand font-black rounded cursor-pointer bg-blue-600 text-white disabled:opacity-50"
                    >
                      {loading ? "Adding..." : "Add to list"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingRecipe(false)}
                      className="px-3 py-1  font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] ai-chat-button"
                    >
                      Back
                    </button>
                    <button
                      disabled={loading}
                      onClick={handleCancel}
                      className="px-3 py-1 rounded text-red-500 font-quicksand font-black   cursor-pointer border border-[var(--ai-chat-border)] ai-chat-button"
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
                              new CustomEvent("lista:ai-adding-start"),
                            );
                          } catch {}
                          let targetListId = propListId;
                          await addItemsWithProgress(targetListId, lastRecipe.ingredients, "this list");
                          showNotification(
                            "Re-added ingredients",
                            "success",
                            1200,
                          );
                          setCanReadd(false);
                          setListEmptied(false);
                        } catch (error) {
                          showNotification(`Added ${error.completed || 0} item(s). Please retry the remaining items.`, "error");
                        } finally {
                          try {
                            window.dispatchEvent(
                              new CustomEvent("lista:ai-adding-end"),
                            );
                          } catch {}
                          setLoading(false);
                        }
                      }}
                      className="px-3 py-1 font-quicksand font-black cursor-pointer  rounded border border-[var(--ai-chat-border)] ai-chat-button"
                    >
                      Re-add {lastRecipe.title}
                    </button>
                  </div>
                )}

              {/* Direct add list selection UI */}
              {pendingDirectAdd &&
                !listSelectionMode &&
                !awaitingNewListName &&
                !loading && (
                  <div className="mt-2 space-y-2">
                    <div className="text-xs ai-chat-help-text">
                      Choose where to add the ingredients:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleListSelectionChoice("existing")}
                        className="px-3 py-1 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                      >
                        Add to existing list
                      </button>
                      <button
                        type="button"
                        onClick={() => handleListSelectionChoice("new")}
                        className="px-3 py-1 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                      >
                        Create new list
                      </button>
                      <button
                        type="button"
                        onClick={() => handleListSelectionChoice("cancel")}
                        className="px-3 py-1 text-red-500 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

              {/* Display available lists when user selects existing */}
              {listSelectionMode === "existing" &&
                availableLists.length > 0 &&
                !loading && (
                  <div className="mt-2 space-y-2">
                    <div className="text-xs ai-chat-help-text">
                      Select a list:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableLists.map((list) => (
                        <button
                          key={list.id}
                          type="button"
                          onClick={() =>
                            handleSelectExistingList(
                              list.id,
                              list.title.rendered ||
                                list.title ||
                                `List ${list.id}`,
                            )
                          }
                          className="px-3 py-1 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                        >
                          {list.title.rendered ||
                            list.title ||
                            `List ${list.id}`}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleListSelectionChoice("cancel")}
                        className="px-3 py-1 text-red-500 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

              {/* Wait for new list name input */}
              {awaitingNewListName &&
                listSelectionMode === "new" &&
                !loading && (
                  <div className="mt-2 space-y-2">
                    <div className="text-xs ai-chat-help-text">
                      Please enter a name for your new list in the input below:
                    </div>
                    <button
                      type="button"
                      onClick={() => handleListSelectionChoice("cancel")}
                      className="px-3 py-1 text-red-500 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                )}

              {/* Show create/cancel options when list not found */}
              {pendingListNotFound && !loading && (
                <div className="mt-2 space-y-2">
                  <div className="text-xs ai-chat-help-text">
                    Choose an action:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        await handleCreateListAndAddNamed(
                          pendingListNotFound.listName,
                          pendingListNotFound.ingredients,
                        );
                        setPendingListNotFound(null);
                      }}
                      className="px-3 py-1 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                    >
                      Create &quot;
                      {pendingListNotFound.listName}&quot;
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingListNotFound(null);
                        setMessages((prev) => [
                          ...prev,
                          {
                            role: "assistant",
                            text: "Okay, cancelled.",
                          },
                        ]);
                      }}
                      className="px-3 py-1 text-red-500 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Show options when duplicate list name detected */}
              {pendingDuplicateList && !loading && (
                <div className="mt-2 space-y-2">
                  <div className="text-xs ai-chat-help-text">
                    Choose an action:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleAddToExistingDuplicate}
                      className="px-3 py-1 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                    >
                      Add to existing list
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateNewAnyway}
                      className="px-3 py-1 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                    >
                      Create new
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDuplicateList(null);
                        setMessages((prev) => [
                          ...prev,
                          {
                            role: "assistant",
                            text: "Okay, cancelled.",
                          },
                        ]);
                      }}
                      className="px-3 py-1 text-red-500 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Show options when list name is too long */}
              {pendingListNameTooLong && !loading && (
                <div className="mt-2 space-y-2">
                  <div className="text-xs ai-chat-help-text">
                    Choose an option:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const { suggestedName, ingredients } =
                          pendingListNameTooLong;
                        setPendingListNameTooLong(null);
                        await handleCreateListAndAddNamed(
                          suggestedName,
                          ingredients,
                        );
                      }}
                      className="px-3 py-1 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                    >
                      Use: &quot;
                      {pendingListNameTooLong.suggestedName}
                      &quot;
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Keep pendingListNameTooLong state to wait for new input
                        setMessages((prev) => [
                          ...prev,
                          {
                            role: "assistant",
                            text: `Please enter a new name (up to ${LIST_NAME_MAX_LENGTH} characters):`,
                          },
                        ]);
                        // Focus the input after a brief delay
                        setTimeout(() => {
                          inputRef.current?.focus?.();
                        }, 100);
                      }}
                      className="px-3 py-1 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                    >
                      Enter new name
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingListNameTooLong(null);
                        setMessages((prev) => [
                          ...prev,
                          {
                            role: "assistant",
                            text: "Okay, cancelled.",
                          },
                        ]);
                      }}
                      className="px-3 py-1 text-red-500 font-quicksand font-black rounded cursor-pointer border border-[var(--ai-chat-border)] text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Conversation starters */}
              {!pendingRecipe &&
                !pendingVariation &&
                !typing &&
                !loading &&
                messages.length === 1 &&
                !pendingDirectAdd &&
                !pendingListNotFound &&
                !pendingDuplicateList &&
                !pendingListNameTooLong && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const ex = "What should I cook tonight?";
                        setInput(ex);
                        handleSubmit(null, ex);
                      }}
                      className="px-2 py-1 font-quicksand font-black cursor-pointer rounded border border-[var(--ai-chat-border)] ai-chat-button"
                    >
                      Dinner ideas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ex = "Help me plan a main dish with a side";
                        setInput(ex);
                        handleSubmit(null, ex);
                      }}
                      className="px-2 py-1 font-quicksand font-black cursor-pointer rounded border border-[var(--ai-chat-border)] ai-chat-button"
                    >
                      Plan a meal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ex = "What can I make with chickpeas and feta?";
                        setInput(ex);
                        handleSubmit(null, ex);
                      }}
                      className="px-2 py-1 font-quicksand font-black cursor-pointer rounded border border-[var(--ai-chat-border)] ai-chat-button"
                    >
                      Use what I have
                    </button>
                  </div>
                )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="ai-chat-composer flex chatbot-input items-center gap-2 p-4 sm:p-5 border-t border-[var(--ai-chat-border)] shrink-0"
            >
              <input
                ref={inputRef}
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  awaitingNewListName
                    ? "Enter list name..."
                    : "Ask anything about meals or your list..."
                }
                disabled={typing || loading}
                className="min-w-0 flex-1 rounded-xl font-quicksand px-4 py-3 disabled:opacity-50 ai-chat-input"
              />
              <button
                type="submit"
                disabled={typing || loading}
                className="px-4 py-3 cursor-pointer font-saira font-black rounded-xl bg-blue-600 text-white disabled:opacity-50 ai-chat-button-blue"
              >
                Send
              </button>
            </form>
          </div>

          <div
            className={`${activeTab === "voice" ? "flex" : "hidden"} ai-chat-voice min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5`}
            role="tabpanel"
            aria-label="Voice shopping list"
            data-lenis-prevent
          >
            <VoiceListInput
              key={`${storageKey || "guest"}:${voiceResetVersion}`}
              context={context}
              listId={propListId}
              token={token}
              userId={userData?.id}
              userLists={userLists}
              getShoppingList={getShoppingList}
              createShoppingList={createShoppingList}
              addItemToList={addItemToList}
              showNotification={showNotification}
              storageKey={storageKey ? `${storageKey}:voice` : null}
              open={open}
              onDraftChange={handleVoiceDraftChange}
              onTaskStarted={() => setOpen(false)}
            />
          </div>

          {resumePrompt && open && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Resume assistant conversation"
              className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--ai-chat)] p-5"
            >
              <div className="w-full max-w-sm rounded-2xl border border-[var(--ai-chat-border)] p-6 shadow-xl space-y-4">
                <div>
                  <h2 className="text-xl font-bold font-saira">
                    Continue where you left off?
                  </h2>
                  <p className="mt-2 text-sm ai-chat-help-text">
                    Your chat and any spoken items are saved on this device.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setResumePrompt(false)}
                    className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={startNewConversation}
                    className="rounded-xl border border-[var(--ai-chat-border)] px-4 py-3 font-bold"
                  >
                    Start new
                  </button>
                </div>
              </div>
            </div>
          )}
          {showHistory && open && (
            <div role="dialog" aria-modal="true" aria-label="Conversation history" className="absolute inset-0 z-50 flex flex-col bg-[var(--ai-chat)] p-5">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--ai-chat-border)] pb-4">
                <div><h2 className="text-xl font-bold font-saira">Conversation history</h2><p className="text-xs ai-chat-help-text">Saved on this device</p></div>
                <button type="button" onClick={() => setShowHistory(false)} aria-label="Close history" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ai-chat-border)]"><X size={18}/></button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-4" data-lenis-prevent>
                {conversationHistory.map((entry) => (
                  <button key={entry.id} type="button" onClick={() => restoreConversation(entry)} className="w-full rounded-xl border border-[var(--ai-chat-border)] p-3 text-left hover:bg-blue-600 hover:text-white">
                    <span className="block truncate font-bold">{entry.title || "Conversation"}</span>
                    <span className="block text-xs opacity-70">{new Date(entry.savedAt).toLocaleString()} · {entry.voice?.items?.length ? "Chat and voice" : "Chat"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ChatWidget;
