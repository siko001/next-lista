import {useEffect, useRef} from "react";
import Pusher from "pusher-js";

export default function useRealtimeAllListDelete(
    userLists,
    setUserLists,
    userId,
    showNotification
) {
    const pusherRef = useRef(null);
    const channelsRef = useRef([]);

    useEffect(() => {
        if (!Array.isArray(userLists) || userLists.length === 0) return;

        // Create Pusher client once
        if (!pusherRef.current) {
            pusherRef.current = new Pusher("a9f747a06cd5ec1d8c62", {
                cluster: "eu",
                forceTLS: true,
                enableStats: false,
            });
        }

        // Subscribe to each list's channel
        channelsRef.current = userLists.map((list) => {
            const channel = pusherRef.current.subscribe(
                "shopping-list-" + list.id
            );
            channel.bind("list-deleted", (data) => {
                if (showNotification && data.sender_id !== userId) {
                    showNotification(
                        data.message || "A list was deleted by another user",
                        "info"
                    );
                }
                setUserLists((prev) =>
                    prev.filter((l) => l.id !== data.list_id)
                );
            });
            return channel;
        });

        // Cleanup on unmount or when userLists changes
        return () => {
            channelsRef.current.forEach((channel) => {
                channel.unbind_all();
                channel.unsubscribe();
            });
            channelsRef.current = [];
            // Do not disconnect the socket here to avoid closing while connecting
        };
    }, [userLists, setUserLists, userId, showNotification]);
}
