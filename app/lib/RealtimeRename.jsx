import {useEffect, useRef} from "react";
import Pusher from "pusher-js";
import {useNotificationContext} from "../contexts/NotificationContext";
import {useListContext} from "../contexts/ListContext";

export default function useRealtimeRename(userId, setListTitle, isInInnerList) {
    const {showNotification} = useNotificationContext();
    const pusherRef = useRef(null);
    const channelRef = useRef(null);

    useEffect(() => {
        if (!userId) return;

        // Create Pusher client once per hook instance
        if (!pusherRef.current) {
            pusherRef.current = new Pusher("a9f747a06cd5ec1d8c62", {
                cluster: "eu",
                forceTLS: true,
                enableStats: false,
            });
        }

        // Subscribe to the user channel
        const channel = pusherRef.current.subscribe("user-lists-" + userId);
        channelRef.current = channel;

        channel.bind("list-summary-updated", (data) => {
            if (data.title && setListTitle) {
                setListTitle(data.title);
            }

            if (
                showNotification &&
                data.sender_id !== userId &&
                data.message &&
                !isInInnerList
            ) {
                if (data.sender_id == userId) return;
                showNotification(
                    data.message || "List updated by other user",
                    "info"
                );
            }
        });

        return () => {
            // Unsubscribe handlers/channel but avoid disconnecting the socket while it's connecting
            if (channelRef.current) {
                channelRef.current.unbind_all();
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }
            // Intentionally do not call pusher.disconnect() here to prevent
            // 'WebSocket is closed before the connection is established' during rapid unmounts.
        };
    }, [userId, setListTitle, isInInnerList, showNotification]);
}
