import CryptoJS from 'crypto-js';

const SECRET_KEY = 'your-secret-key-123'; // Must match the key used for encryption

const decryptToken = (encryptedToken) => {
    try {

        if (!encryptedToken) return null;
        // Decrypt (AES decryption expects a Base64-encoded string)
        const bytes = CryptoJS.AES.decrypt(encryptedToken, SECRET_KEY);
        const decryptedToken = bytes.toString(CryptoJS.enc.Utf8);

        // Remove any surrounding quotes
        const cleanToken = decryptedToken.replace(/^"|"$/g, '');
        if (!decryptedToken || decryptedToken.split('.').length !== 3) {
            throw new Error("Decrypted token is not a valid JWT");
        }

        return cleanToken;
    } catch (error) {
        console.error("Failed to decrypt token:", error);
        return null;
    }
};

const WP_API_BASE = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';

// Fetch shopping lists for the user
export const getShoppingList = async (userId, encryptedToken) => {

    // Decrypt the token
    const token = decryptToken(encryptedToken);
    if (!token) {
        return [];
    }


    // Change to ASCENDING order to match typical UI expectations
    const url = `${WP_API_BASE}/wp/v2/shopping-list?orderby=menu_order&order=asc&per_page=100`;

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();
        const result = Array.isArray(data)
            ? data.filter(list => list.acf?.owner_id == userId)
            : [];
        return result;
    } catch (error) {
        console.error("Failed to fetch lists:", error);
        return [];
    }
};