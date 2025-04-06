const WP_API_BASE = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';

export const getSharedList = async (listId) => {
    try {
        const response = await fetch(`${WP_API_BASE}/custom/v1/shared-list/${listId}`);
        return await response.json();
    } catch (error) {
        return { success: false, message: 'Network error' };
    }
};

export const addToSharedLists = async (listId) => {
    try {
        const response = await fetch(`${WP_API_BASE}/custom/v1/share-list`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                list_id: listId,
                sharer_id: 'unknown'
            })
        });
        return await response.json();
    } catch (error) {
        return { success: false };
    }
};