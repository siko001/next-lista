import {useEffect, useRef} from "react";
import {subscribePusherEvent} from "./pusherClient";

export default function useListaRealtimeUpdates(listId, callback) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        if (!listId) return;
        return subscribePusherEvent("shopping-list-" + listId, "list-updated", (data) => {
            callbackRef.current(data);
        });
    }, [listId]);
}
