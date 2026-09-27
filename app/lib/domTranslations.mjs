import Fuse from "fuse.js";

const translatedText = new Map();
const translationsByKey = new Map();

export function rememberTranslation(language, key, original, rendered) {
    if (!language || language === "en" || !key || !rendered || rendered === original) return false;
    // During a language switch Google can leave the previous translation in
    // the DOM briefly. Do not index that word under the new language.
    const knownLanguages = translationsByKey.get(key);
    if (knownLanguages && [...knownLanguages].some(([otherLanguage, value]) => otherLanguage !== language && value === rendered)) return false;
    const storeKey = `${language}:${key}`;
    // Multiple copies of a label may be translated slightly differently by
    // Google. Keep the first result so observers do not trigger render loops.
    if (translatedText.has(storeKey)) return false;
    translatedText.set(storeKey, rendered);
    if (!translationsByKey.has(key)) translationsByKey.set(key, new Map());
    translationsByKey.get(key).set(language, rendered);
    return true;
}

export function getTranslation(language, key) {
    return translatedText.get(`${language}:${key}`) || null;
}

export function searchProductsInLanguage(products, query, language, options = {}) {
    if (!query?.trim()) return products;
    const indexed = products.map((product) => ({
        original: product,
        title: product.title || "",
        translatedTitle: getTranslation(language, `product:${product.id || product.ID}`) || "",
    }));
    const fuse = new Fuse(indexed, {
        threshold: options.threshold ?? 0.3,
        distance: options.distance ?? 100,
        keys: ["title", "translatedTitle"],
    });
    return fuse.search(query).map(({item}) => item.original);
}
