import { useEffect } from "react";
import Pusher from "pusher-js";
import { useNotificationContext } from "../contexts/NotificationContext";
import { useListContext } from "../contexts/ListContext";

export default function useUserListsRealtime(
  userId,
  setUserLists,
  isInInnerList
) {
  const { showNotification } = useNotificationContext();
  useEffect(() => {
    if (!userId) return;
    const pusher = new Pusher("a9f747a06cd5ec1d8c62", { cluster: "eu" });
    const channel = pusher.subscribe("user-lists-" + userId);
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
                  bagged_product_count: data.bagged_product_count,
                  checked_product_count: data.checked_product_count,
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
        showNotification(data.message || "List updated by other user", "info");
      }
    });
    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [userId, setUserLists, isInInnerList]);
}
