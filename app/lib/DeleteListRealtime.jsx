import { useEffect } from "react";
import Pusher from "pusher-js";
import { useRouter } from "next/navigation";

export default function useRealtimeListDelete(
  listId,
  userId,
  showNotification
) {
  const router = useRouter();

  useEffect(() => {
    if (!listId) return;
    const pusher = new Pusher("a9f747a06cd5ec1d8c62", { cluster: "eu" });
    const channel = pusher.subscribe("shopping-list-" + listId);

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
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [listId, userId, showNotification, router]);
}
