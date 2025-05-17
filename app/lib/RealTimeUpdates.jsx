import { useEffect, useRef } from "react";
import Pusher from "pusher-js";

/**
 * Custom hook to listen for real-time updates on a shopping list.
 * @param {string|number} listId - The ID of the shopping list.
 * @param {function} onUpdate - Callback to handle incoming data.
 */
// export default function useListaRealtimeUpdates(listId, onUpdate) {
//   useEffect(() => {
//     if (!listId) return;

//     const pusher = new Pusher("a9f747a06cd5ec1d8c62", {
//       cluster: "eu",
//       encrypted: true,
//     });

//     const channel = pusher.subscribe(`shopping-list-${listId}`);
//     channel.bind("list-updated", (data) => {
//       if (typeof onUpdate === "function") {
//         onUpdate(data);
//       }
//     });

//     return () => {
//       channel.unbind_all();
//       channel.unsubscribe();
//       pusher.disconnect();
//     };
//   }, [listId, onUpdate]);
// }

export default function useListaRealtimeUpdates(listId, callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const pusher = new Pusher("a9f747a06cd5ec1d8c62", { cluster: "eu" });
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
