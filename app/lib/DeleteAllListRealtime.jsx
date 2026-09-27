import {useEffect} from "react";
import {subscribePusherEvent} from "./pusherClient";
import {invalidateListData} from "./dataCache.mjs";

export default function useRealtimeAllListDelete(
    userLists,
    setUserLists,
    userId,
    showNotification
) {
    const listIds = Array.isArray(userLists)
        ? userLists.map((list) => String(list.id)).sort().join(",")
        : "";
    useEffect(() => {
        if (!listIds) return;
        const releases = listIds.split(",").map((id) =>
            subscribePusherEvent("shopping-list-" + id, "list-deleted", (data) => {
                invalidateListData(userId);
                if (showNotification && String(data.sender_id) !== String(userId)) {
                    showNotification(
                        data.message || "A list was deleted by another user",
                        "info"
                    );
                }
                setUserLists((prev) =>
                    prev.filter((l) => String(l.id) !== String(data.list_id))
                );
            })
        );

        return () => releases.forEach((release) => release());
    }, [listIds, setUserLists, userId, showNotification]);
}
