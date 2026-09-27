import {useEffect, useRef} from "react";
import {useNotificationContext} from "../contexts/NotificationContext";
import {useListContext} from "../contexts/ListContext";
import {invalidateListData} from "./dataCache.mjs";
import {subscribePusherEvent} from "./pusherClient";

export default function useUserListsRealtime(userId, setUserLists, isInInnerList) {
    const {showNotification} = useNotificationContext();
    const {userLists} = useListContext();
    const listsRef = useRef(userLists);
    listsRef.current = userLists;

    useEffect(() => {
        if (!userId) return;

        return subscribePusherEvent("user-lists-" + userId, "list-summary-updated", (data) => {
            invalidateListData(userId);
            const current = listsRef.current.find((list) => String(list.id) === String(data.list_id));
            const titleChanged = current && data.title && current.title !== data.title;
            setUserLists((prev) => prev.map((list) =>
                String(list.id) === String(data.list_id)
                    ? {
                        ...list,
                        title: data.title ?? list.title,
                        acf: {
                            ...list.acf,
                            product_count: data.product_count ?? list.acf?.product_count,
                            bagged_product_count: data.bagged_product_count ?? list.acf?.bagged_product_count,
                            checked_product_count: data.checked_product_count ?? list.acf?.checked_product_count,
                        },
                        updated_at: data.updated_at ?? list.updated_at,
                    }
                    : list
            ));

            if (titleChanged && showNotification && String(data.sender_id) !== String(userId) && !isInInnerList) {
                showNotification("List renamed", "info");
            }
        });
    }, [userId, setUserLists, isInInnerList, showNotification]);
}
