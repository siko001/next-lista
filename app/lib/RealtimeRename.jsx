import { useEffect } from "react";
import Pusher from "pusher-js";
import { useNotificationContext } from "../contexts/NotificationContext";
import { useListContext } from "../contexts/ListContext";

export default function useRealtimeRename(userId, setListTitle, isInInnerList) {
  const { showNotification } = useNotificationContext();
  useEffect(() => {
    if (!userId) return;
    const pusher = new Pusher("a9f747a06cd5ec1d8c62", { cluster: "eu" });
    const channel = pusher.subscribe("user-lists-" + userId);
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
        showNotification(data.message || "List updated by other user", "info");
      }
    });
    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [userId, setListTitle, isInInnerList]);
}
