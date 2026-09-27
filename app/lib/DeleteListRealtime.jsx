import {useEffect} from "react";
import {subscribePusherEvent} from "./pusherClient";
import {useRouter} from "next/navigation";

export default function useRealtimeListDelete(listId, userId, showNotification) {
    const router = useRouter();

    useEffect(() => {
        if (!listId) return;
        return subscribePusherEvent("shopping-list-" + listId, "list-deleted", (data) => {
            if (showNotification && String(data.sender_id) !== String(userId)) {
                showNotification(data.message || "This list was deleted by another user", "info");
            }
            router.push("/");
        });
    }, [listId, userId, showNotification, router]);
}
