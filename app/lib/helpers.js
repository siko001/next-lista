import CryptoJS from "crypto-js";
export const SECRET_KEY = "your-secret-key-123";
export const WP_API_BASE =
    "https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json";

export const decryptToken = (encryptedToken) => {
    try {
        if (!encryptedToken) return null;
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
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch list details:", error);
        return null;
    }
};

export const getAllProducts = async (encryptedToken) => {
    const token = decryptToken(encryptedToken);
    if (!token) {
        return [];
    }
    const url = `${WP_API_BASE}/custom/v1/products`;
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch all products:", error);
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
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch linked products:", error);
        return [];
    }
};

export const extractUserName = (jsonString) => {
    try {
        const data = JSON.parse(jsonString);
        return data.userName || null;
    } catch (error) {
        console.error("Invalid JSON:", error);
        return null;
    }
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
        }
    );

    const baggedData = await baggedResponse.json();
    return baggedData;
};

export const getAllCustomProducts = async (token) => {
    const decryptedToken = decryptToken(token);
    const res = await fetch(`${WP_API_BASE}/custom/v1/get-custom-products`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${decryptedToken}`,
        },
    });
    const data = await res.json();
    return data;
};

export const getFavourites = async (token) => {
    const decryptedToken = decryptToken(token);
    try {
        const res = await fetch(`${WP_API_BASE}/custom/v1/get-favourites`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${decryptedToken}`,
            },
        });
        return await res.json();
    } catch (error) {
        console.error("Error fetching favourites:", error);
        return {success: false, favourites: []};
    }
};

export const calculateProgress = (productCount, baggedProductCount) => {
    if (productCount === 0) {
        return 0;
    }
    return Math.round((baggedProductCount / productCount) * 100);
};
