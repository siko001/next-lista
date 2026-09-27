// Compare shopping ingredients within one destination list. Quantity and simple
// preparation changes don't create another item; varieties and dietary modifiers do.
const UNITS = /^(?:tablespoons?|teaspoons?|tbsp|tsp|cups?|grams?|kilograms?|milligrams?|g|kg|mg|millilit(?:er|re)s?|lit(?:er|re)s?|ml|l|ounces?|oz|pounds?|lbs?|cans?|tins?|jars?|cloves?|bunch(?:es)?|pinch(?:es)?|handfuls?|sprigs?)\b\.?\s*(?:of\s+)?/;
const QUANTITY = /^(?:\d+(?:\.\d+)?(?:\s*\/\s*\d+)?(?:\s+\d+\s*\/\s*\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?|a|an)(?:\s+|(?=[a-z]))/;
const PREP = /(?:,\s*|\s+)(?:(?:finely|roughly|thinly|thickly|freshly)\s+)?(?:chopped|diced|sliced|halved|drained|rinsed|peeled|pitted|minced|grated)(?:\s+and\s+(?:(?:finely|roughly|thinly|thickly|freshly)\s+)?(?:chopped|diced|sliced|halved|drained|rinsed|peeled|pitted|minced|grated))*$/;
const PLURALS = new Map(Object.entries({
    cucumbers: "cucumber", tomatoes: "tomato", olives: "olive", chickpeas: "chickpea",
    onions: "onion", lemons: "lemon", limes: "lime", carrots: "carrot", potatoes: "potato",
    peppers: "pepper", mushrooms: "mushroom", eggs: "egg", breads: "bread",
}));
const normal = (title) => String(title || "").normalize("NFKC").toLowerCase()
    .replace(/⁄/g, "/").replace(/&(?:amp;)?/g, " and ").replace(/\s+/g, " ").trim();

export function ingredientIdentity(title) {
    let value = normal(title);
    // Strip quantity and its unit together (including 200g without a space).
    // A percentage describes the product, e.g. 2% milk, and must be preserved.
    if (!/^\d+(?:\.\d+)?\s*%/.test(value)) {
        const withoutAmount = value.replace(QUANTITY, "");
        if (withoutAmount !== value) value = withoutAmount.replace(UNITS, "");
    }
    value = value.replace(/\s+(?:to taste|for serving)$/, "").trim();
    let previous;
    do { previous = value; value = value.replace(PREP, "").trim(); } while (value !== previous);
    value = value.replace(/\bkal\.?\s+olives?\b/g, "kalamata olive")
        .replace(/\bpitta\b/g, "pita");
    return value.replace(/[^\p{L}\p{N}%]+/gu, " ").trim().split(/\s+/)
        .map((word) => PLURALS.get(word) || word).join(" ");
}

export function findMatchingListProduct(products, title) {
    const exact = products.find((product) => normal(product.title) === normal(title));
    if (exact) return exact;
    const identity = ingredientIdentity(title);
    return identity ? products.find((product) => ingredientIdentity(product.title) === identity) || null : null;
}
