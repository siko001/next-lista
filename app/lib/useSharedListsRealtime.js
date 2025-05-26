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

        const channel = pusher.subscribe("user-lists-" + userId);

        channel.bind("share-update", (data) => {
            if (data.userId === userId) {
                // If current user was removed from a list
                setUserLists((prevLists) => {
                    const filteredLists = prevLists.filter((list) => {
                        const shouldKeep = list.id !== parseInt(data.listId);
                        return shouldKeep;
                    });
                    return [...filteredLists];
                });
                // Only show notification if we're not in the inner list view
                // (inner list view will handle its own notification)
                if (!window.location.pathname.includes("/list/")) {
                    showNotification(
                        "The list owner has removed you from this list",
                        "info"
                    );
                }
            } else {
                // If another user was removed from a list the current user owns/has access to
                setUserLists((prevLists) => {
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

                    return [...updatedLists];
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
