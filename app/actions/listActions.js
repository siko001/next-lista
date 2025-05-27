"use server";

export async function getListMetadata(list, userId) {
    if (!list || !userId) {
        return {
            isOwner: false,
            ownerName: "",
            listId: null,
        };
    }

    try {
        const isOwner = list?.acf?.owner_id === userId?.toString();
        const ownerName = list?.acf?.owner_name || "";

        return {
            isOwner,
            ownerName,
            listId: list.id,
        };
    } catch (error) {
        console.error("Error getting list metadata:", error);
        return {
            isOwner: false,
            ownerName: "",
            listId: list?.id || null,
        };
    }
}
