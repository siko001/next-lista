import { useEffect } from "react";
import Pusher from "pusher-js";

export default function useRealtimeAllListDelete(
  userLists,
  setUserLists,
  userId,
  showNotification
) {
  useEffect(() => {
    if (!userLists || userLists.length === 0) return;
    const pusher = new Pusher("a9f747a06cd5ec1d8c62", { cluster: "eu" });

    // Subscribe to each list's channel
    if (!Array.isArray(userLists) || userLists.length === 0) return;
    const channels = userLists.map((list) => {
      const channel = pusher.subscribe("shopping-list-" + list.id);
      channel.bind("list-deleted", (data) => {
        if (showNotification && data.sender_id !== userId) {
          showNotification(
            data.message || "A list was deleted by another user",
            "info"
          );
        }
        setUserLists((prev) => prev.filter((l) => l.id !== data.list_id));
      });
      return channel;
    });

    // Cleanup on unmount or when userLists changes
    return () => {
      channels.forEach((channel) => {
        channel.unbind_all();
        channel.unsubscribe();
      });
      pusher.disconnect();
    };
  }, [userLists, setUserLists, userId, showNotification]);
}
