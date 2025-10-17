import {useEffect, useRef} from "react";
import Pusher from "pusher-js";

/**
 * Custom hook to listen for real-time updates on a shopping list.
 * @param {string|number} listId - The ID of the shopping list.
 * @param {function} onUpdate - Callback to handle incoming data.
 */
export default function useListaRealtimeUpdates(listId, callback) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    const pusherRef = useRef(null);
    const channelRef = useRef(null);

    useEffect(() => {
        if (!listId) return;

        if (!pusherRef.current) {
            pusherRef.current = new Pusher("a9f747a06cd5ec1d8c62", {
                cluster: "eu",
                forceTLS: true,
                enableStats: false,
            });
        }

        const channelName = "shopping-list-" + listId;
        const channel = pusherRef.current.subscribe(channelName);
        channelRef.current = channel;

        const handler = (data) => {
            callbackRef.current(data);
        };

        channel.bind("list-updated", handler);

        return () => {
            if (channelRef.current) {
                channelRef.current.unbind("list-updated", handler);
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }
            // keep socket open to avoid closing while connecting
        };
    }, [listId]);
}
