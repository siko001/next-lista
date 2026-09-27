import CryptoJS from "crypto-js";
import {assistantHttpError} from "./assistantJobErrors.mjs";
import {getCookie} from "cookies-next";
import {cachedRead, cacheKeys, CACHE_TTL, invalidateCurrentLists} from "./dataCache.mjs";
export const SECRET_KEY = "your-secret-key-123";
export const WP_API_BASE =
    "https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json";

export const decryptToken = (encryptedToken) => {
    try {
        if (!encryptedToken) return null;
        // If it already looks like a JWT, return as-is (avoid double decryption)
        if (
            typeof encryptedToken === "string" &&
            encryptedToken.split(".").length === 3
        ) {
            return encryptedToken;
        }
        // Decrypt (AES decryption expects a Base64-encoded string)
        const bytes = CryptoJS.AES.decrypt(encryptedToken, SECRET_KEY);
        const decryptedToken = bytes.toString(CryptoJS.enc.Utf8);

        // Remove any surrounding quotes
        const cleanToken = decryptedToken.replace(/^"|"$/g, "");
        if (!decryptedToken || decryptedToken.split(".").length !== 3) {
            throw new Error("Decrypted token is not a valid JWT");
        }

        return cleanToken;
    } catch (error) {
        console.error("Failed to decrypt token:", error);
        return null;
    }
};

const browserUserId = () => typeof window === "undefined" ? null : getCookie("id");
const privateFetchOptions = () => ({cache: "no-store"});

// Fetch shopping lists for the user
export const getShoppingList = async (userId, encryptedToken) => {
    // Decrypt the token
    const token = decryptToken(encryptedToken);
    if (!token) {
        return [];
    }

    // Change to ASCENDING order to match typical UI expectations
    const url = `${WP_API_BASE}/custom/v1/shopping-lists-by-owner/${userId}`;

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            ...privateFetchOptions(),
        });

        const data = await response.json();
        // BEFORE UPDATING TO INCLUDE THE SHARED LISTS (ALSO IN LIST CONTEXT)
        // const result = Array.isArray(data)
        //     ? data.filter(list => list.acf?.owner_id == userId)
        //     : [];

        // // sort by menu_order
        // result.sort((a, b) => {
        //     return a.menu_order - b.menu_order;
        // });
        // return result;

        const filteredLists = Array.isArray(data)
            ? data.filter((list) => {
                  const isOwner = list?.acf?.owner_id == userId;
                  const isShared =
                      list?.acf?.shared_with_users != false &&
                      list?.acf?.shared_with_users?.some(
                          (user) => user.ID == userId
                      );
                  return isOwner || isShared;
              })
            : [];

        // Sort by menu_order
        filteredLists.sort((a, b) => a.menu_order - b.menu_order);
        return filteredLists;
    } catch (error) {
        console.error("Failed to fetch lists:", error);
        return [];
    }
};

export const getListDetails = async (listId, encryptedToken) => {
    const token = decryptToken(encryptedToken);
    if (!token) {
        return null;
    }
    const url = `${WP_API_BASE}/custom/v1/shopping-list/${listId}`;
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            ...privateFetchOptions(),
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch list details:", error);
        return null;
    }
};

export const getAllProducts = async (encryptedToken, {strict = false} = {}) => {
    const token = decryptToken(encryptedToken);
    if (!token) {
        if (strict) throw new Error("No product catalogue session");
        return [];
    }
    const url = `${WP_API_BASE}/custom/v1/products`;
    const load = async () => {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            // The catalogue is shared and changes only when products are published.
            ...(typeof window === "undefined" ? {next: {revalidate: 600}} : {}),
        });
        if (!response.ok) throw assistantHttpError(response.status, "Failed to fetch product catalogue");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid product catalogue");
        return data;
    };
    try {
        return await cachedRead(cacheKeys.catalogue, CACHE_TTL.catalogue, load);
    } catch (error) {
        console.error("Failed to fetch all products:", error);
        if (strict) throw error;
        return [];
    }
};

export const getLinkedProducts = async (shoppingListId, encryptedToken) => {
    const token = decryptToken(encryptedToken);
    if (!token) {
        return [];
    }
    const url = `${WP_API_BASE}/custom/v1/get-shopping-list-products?shoppingListId=${shoppingListId}`;
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            ...privateFetchOptions(),
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch linked products:", error);
        return [];
    }
};

export const extractUserName = (value) => {
    if (!value) return null;

    // If already an object, try common keys
    if (typeof value === "object") {
        return value.userName || value.username || value.name || null;
    }

    // If a string, try JSON first; if it fails, return the string itself
    if (typeof value === "string") {
        const trimmed = value.trim();
        // Quick check: looks like JSON object
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            try {
                const data = JSON.parse(trimmed);
                return data.userName || data.username || data.name || null;
            } catch (_) {
                // fall through to return the raw string
            }
        }
        return trimmed;
    }

    return null;
};

export const decodeHtmlEntities = (text) => {
    if (!text) return "";

    if (typeof document === "undefined") {
        return text.replace(/&#(\d+);/g, (match, dec) =>
            String.fromCharCode(dec)
        );
    }

    // For browser
    const textArea = document.createElement("textarea");
    textArea.innerHTML = text;
    return textArea.value;
};

// 3. Fetch bagged items for A list
export const getBaggedItems = async (shoppingListId, token) => {
    if (!token || !shoppingListId) {
        return [];
    }
    // Decrypt the token
    const decryptedToken = decryptToken(token);
    const baggedResponse = await fetch(
        `${WP_API_BASE}/custom/v1/get-bagged-products?shoppingListId=${shoppingListId}`,
        {
            headers: {
                Authorization: `Bearer ${decryptedToken}`,
            },
            ...privateFetchOptions(),
        }
    );

    const baggedData = await baggedResponse.json();
    return baggedData;
};

export const getAllCustomProducts = async (token) => {
    const decryptedToken = decryptToken(token);
    if (!decryptedToken) return [];
    const load = async () => {
        const res = await fetch(`${WP_API_BASE}/custom/v1/get-custom-products`, {
            method: "GET",
            headers: {"Content-Type": "application/json", Authorization: `Bearer ${decryptedToken}`},
            ...privateFetchOptions(),
        });
        if (!res.ok) throw new Error(`Failed to fetch custom products (HTTP ${res.status})`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid custom products");
        return data;
    };
    const userId = browserUserId();
    return userId ? cachedRead(cacheKeys.customProducts(userId), CACHE_TTL.customProducts, load) : load();
};

export const getFavourites = async (token) => {
    const decryptedToken = decryptToken(token);
    if (!decryptedToken) return [];
    try {
        const load = async () => {
            const res = await fetch(`${WP_API_BASE}/custom/v1/get-favourites`, {
                method: "GET",
                headers: {"Content-Type": "application/json", Authorization: `Bearer ${decryptedToken}`},
                ...privateFetchOptions(),
            });
            if (!res.ok) throw new Error("Failed to fetch favourites");
            const data = await res.json();
            const favourites = Array.isArray(data) ? data : data?.favourites;
            if (!Array.isArray(favourites)) throw new Error("Invalid favourites");
            return favourites;
        };
        const userId = browserUserId();
        return userId ? await cachedRead(cacheKeys.favourites(userId), CACHE_TTL.favourites, load) : await load();
    } catch (error) {
        console.error("Error fetching favourites:", error);
        return [];
    }
};

export const calculateProgress = (productCount, baggedProductCount) => {
    if (productCount === 0) {
        return 0;
    }
    return Math.round((baggedProductCount / productCount) * 100);
};

export function isListOwner(list, userId) {
    if (!list || !list.acf || !userId) return false;
    return list.acf.owner_id === userId.toString();
}

export const removeListRelationship = async (
    listId,
    userId,
    token,
    origin = "home"
) => {
    try {
        let tokenToUse = token;
        if (origin === "inner") {
            tokenToUse = decryptToken(token);
        }

        const res = await fetch(
            `${WP_API_BASE}/custom/v1/remove-user-from-shared`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokenToUse}`,
                },
                body: JSON.stringify({
                    listId: parseInt(listId),
                    userId: parseInt(userId),
                }),
            }
        );

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        invalidateCurrentLists();

        const text = await res.text();

        try {
            const data = JSON.parse(text);
            return data;
        } catch (e) {}
    } catch (error) {}
};
