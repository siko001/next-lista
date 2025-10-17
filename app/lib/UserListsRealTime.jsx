import {useEffect, useRef} from "react";
import Pusher from "pusher-js";
import {useNotificationContext} from "../contexts/NotificationContext";
import {useListContext} from "../contexts/ListContext";

export default function useUserListsRealtime(
    userId,
    setUserLists,
    isInInnerList
) {
    const {showNotification} = useNotificationContext();
    const pusherRef = useRef(null);
    const channelRef = useRef(null);

    useEffect(() => {
        if (!userId) return;

        if (!pusherRef.current) {
            pusherRef.current = new Pusher("a9f747a06cd5ec1d8c62", {
                cluster: "eu",
                forceTLS: true,
                enableStats: false,
            });
        }

        const channel = pusherRef.current.subscribe("user-lists-" + userId);
        channelRef.current = channel;

        channel.bind("list-summary-updated", (data) => {
            setUserLists((prev) =>
                prev.map((list) =>
                    list.id === data.list_id
                        ? {
                              ...list,
                              title: data.title,
                              acf: {
                                  ...list.acf,
                                  product_count: data.product_count,
                                  bagged_product_count:
                                      data.bagged_product_count,
                                  checked_product_count:
                                      data.checked_product_count,
                              },
                              updated_at: data.updated_at,
                          }
                        : list
                )
            );

            if (
                showNotification &&
                data.sender_id !== userId &&
                data.message &&
                !isInInnerList
            ) {
                showNotification(
                    data.message || "List updated by other user",
                    "info"
                );
            }
        });

        return () => {
            if (channelRef.current) {
                channelRef.current.unbind_all();
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }
            // keep socket open to avoid closing while connecting
        };
    }, [userId, setUserLists, isInInnerList, showNotification]);
}
