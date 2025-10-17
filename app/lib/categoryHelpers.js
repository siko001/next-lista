/**
 * Get unique categories from a list of products
 * @param {Array} products - Array of products with categories property
 * @returns {Array} - Array of unique categories sorted alphabetically
 */
import {decodeHtmlEntities} from "./helpers";

export const getUniqueCategories = (products) => {
    if (!Array.isArray(products)) return [];

    // Extract all categories from products and flatten the array
    const allCategories = products.reduce((acc, product) => {
        if (product.categories && Array.isArray(product.categories)) {
            const decoded = product.categories.map((c) =>
                typeof c === "string" ? decodeHtmlEntities(c) : c
            );
            return [...acc, ...decoded];
        }

        return acc;
    }, []);

    // Remove duplicates using Set and sort alphabetically
    return [...new Set(allCategories)].sort((a, b) =>
        String(a).localeCompare(String(b))
    );
};

/**
 * Group products by their categories
 * @param {Array} products - Array of products with categories property
 * @returns {Object} - Object with categories as keys and arrays of products as values
 */
export const groupProductsByCategory = (products) => {
    if (!Array.isArray(products)) return {};

    return products.reduce((acc, product) => {
        if (product.categories && Array.isArray(product.categories)) {
            product.categories.forEach((category) => {
                if (!acc[category]) {
                    acc[category] = [];
                }
                acc[category].push(product);
            });
        }
        return acc;
    }, {});
};
