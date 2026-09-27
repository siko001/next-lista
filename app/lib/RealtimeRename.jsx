import {useEffect, useRef} from "react";
import {subscribePusherEvent} from "./pusherClient";
import {useNotificationContext} from "../contexts/NotificationContext";
import {invalidateListData} from "./dataCache.mjs";

export default function useRealtimeRename(userId, listId, listTitle, setListTitle, isInInnerList) {
    const {showNotification} = useNotificationContext();
    const titleRef = useRef(listTitle);

    useEffect(() => {
        titleRef.current = listTitle;
    }, [listTitle]);

    useEffect(() => {
        if (!userId) return;

        return subscribePusherEvent("user-lists-" + userId, "list-summary-updated", (data) => {
            invalidateListData(userId);
            if (String(data.list_id) !== String(listId) || !data.title || data.title === titleRef.current) return;
            titleRef.current = data.title;
            setListTitle(data.title);
            if (showNotification && !isInInnerList) showNotification("List renamed", "info");
        });
    }, [userId, listId, setListTitle, isInInnerList, showNotification]);
}
