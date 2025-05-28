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

    useEffect(() => {
        const pusher = new Pusher("a9f747a06cd5ec1d8c62", {cluster: "eu"});
        const channelName = "shopping-list-" + listId;
        const channel = pusher.subscribe(channelName);

        const handler = (data) => {
            callbackRef.current(data);
        };

        channel.bind("list-updated", handler);

        return () => {
            channel.unbind("list-updated", handler);
            pusher.unsubscribe(channelName);
            pusher.disconnect();
        };
    }, [listId]);
}
