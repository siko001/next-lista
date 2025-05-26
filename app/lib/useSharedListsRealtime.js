"use client";

import {useEffect} from "react";
import Pusher from "pusher-js";

export default function useSharedListsRealtime(
    userId,
    setUserLists,
    showNotification
) {
    useEffect(() => {
        if (!userId) return;

        // Initialize Pusher with your app key
        const pusher = new Pusher("a9f747a06cd5ec1d8c62", {
            cluster: "eu",
        });

        // Subscribe to user-specific channel
        const channel = pusher.subscribe("user-lists-" + userId);

        // Handle user removal
        channel.bind("share-update", (data) => {
            console.log("Received share-update:", data);

            if (data.userId === userId) {
                // If current user was removed from a list
                setUserLists((prevLists) => {
                    console.log("Previous lists:", prevLists);
                    // Create a new array reference to ensure React detects the change
                    const filteredLists = prevLists.filter((list) => {
                        const shouldKeep = list.id !== parseInt(data.listId);
                        if (!shouldKeep) {
                            console.log("Removing list:", list.id);
                        }
                        return shouldKeep;
                    });
                    console.log("Updated lists:", filteredLists);
                    return [...filteredLists]; // Create new array reference
                });
                showNotification("You were removed from a shared list", "info");
            } else {
                // If another user was removed from a list the current user owns/has access to
                setUserLists((prevLists) => {
                    // Create a new array reference to ensure React detects the change
                    const updatedLists = prevLists.map((list) => {
                        if (list.id === parseInt(data.listId)) {
                            const updatedSharedUsers = list.acf
                                .shared_with_users
                                ? list.acf.shared_with_users.filter(
                                      (user) =>
                                          user.ID !== parseInt(data.userId)
                                  )
                                : [];

                            return {
                                ...list,
                                acf: {
                                    ...list.acf,
                                    shared_with_users: updatedSharedUsers,
                                },
                            };
                        }
                        return list;
                    });

                    return [...updatedLists]; // Create new array reference
                });
            }
        });

        // Cleanup on unmount
        return () => {
            channel.unbind_all();
            pusher.unsubscribe("user-lists-" + userId);
        };
    }, [userId, setUserLists, showNotification]);
}
