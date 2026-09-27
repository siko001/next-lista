"use client";

import {useEffect, useRef} from "react";
import {subscribePusherEvent} from "./pusherClient";
import {invalidateListData} from "./dataCache.mjs";

export default function useSharedListsRealtime(
    userId,
    setUserLists,
    showNotification
) {
    const recentRef = useRef(new Map());

    useEffect(() => {
        if (!userId) return;

        const isDuplicate = (data) => {
            const key = `${data.action}:${data.listId}:${data.userId}:${data.actorId || ''}`;
            const now = Date.now();
            const last = recentRef.current.get(key) || 0;
            // 2s window
            if (now - last < 2000) return true;
            recentRef.current.set(key, now);
            // prune old
            for (const [k, t] of recentRef.current.entries()) {
                if (now - t > 5000) recentRef.current.delete(k);
            }
            return false;
        };

        return subscribePusherEvent("user-lists-" + userId, "share-update", (data) => {
            invalidateListData(userId);
            if (data.action !== 'remove') return; // only handle removals here
            if (isDuplicate(data)) return;
            if (parseInt(data.userId) === parseInt(userId)) {
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
                    const selfRemoved =
                        parseInt(data.actorId) === parseInt(userId);
                    if (selfRemoved) {
                        showNotification(
                            "List removed successfully",
                            "success"
                        );
                    } else {
                        showNotification(
                            "The list owner has removed you from this list",
                            "info"
                        );
                    }
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

                // Notify owner/shared users who remain
                const someoneLeft =
                    parseInt(data.actorId) === parseInt(data.userId);
                const name = data.userName || "A user";
                showNotification(
                    someoneLeft
                        ? `${name} left the list`
                        : `${name} was removed from the list`,
                    someoneLeft ? "info" : "warning"
                );
            }
        });
    }, [userId, setUserLists, showNotification]);
}
