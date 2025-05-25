"use server";

export async function getListMetadata(list, userId) {
    const isOwner = list?.acf?.owner_id === userId?.toString();
    const ownerName = list?.acf?.owner_name || "";

    return {
        isOwner,
        ownerName,
        listId: list.id,
    };
}
