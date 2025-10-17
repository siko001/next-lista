import {useEffect, useRef} from "react";
import {getPusher} from "./pusherClient";
import {useRouter} from "next/navigation";

export default function useRealtimeListDelete(
    listId,
    userId,
    showNotification
) {
    const router = useRouter();
    const pusherRef = useRef(null);
    const channelRef = useRef(null);

    useEffect(() => {
        if (!listId) return;
        if (!pusherRef.current) {
            pusherRef.current = getPusher();
        }
        const channel = pusherRef.current.subscribe("shopping-list-" + listId);
        channelRef.current = channel;

        channel.bind("list-deleted", (data) => {
            if (showNotification && data.sender_id !== userId) {
                showNotification(
                    data.message || "This list was deleted by another user",
                    "info"
                );
            }
            router.push("/");
        });

        return () => {
            if (channelRef.current) {
                channelRef.current.unbind_all();
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }
            // keep socket open
        };
    }, [listId, userId, showNotification, router]);
}
