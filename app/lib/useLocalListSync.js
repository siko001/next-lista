"use client";

import {useEffect, useRef} from "react";
import {subscribeListInvalidation, cacheKeys, cacheVersion} from "./dataCache.mjs";

// Cache invalidations already travel through BroadcastChannel, without Pusher.
// Refresh the visible data too, coalescing bursts and ignoring obsolete reads.
export default function useLocalListSync(userId, refresh) {
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;
    useEffect(() => {
        if (!userId) return;
        let timer;
        let controller;
        const unsubscribe = subscribeListInvalidation(userId, () => {
            clearTimeout(timer);
            controller?.abort();
            timer = setTimeout(() => {
                controller = new AbortController();
                const signal = controller.signal;
                const version = cacheVersion(cacheKeys.lists(userId));
                const isCurrent = () => !signal.aborted && version === cacheVersion(cacheKeys.lists(userId));
                Promise.resolve(refreshRef.current({signal, isCurrent})).catch(() => {
                    // Leave the visible list intact if this refresh cannot reach WordPress.
                });
            }, 100);
        });
        return () => { unsubscribe(); clearTimeout(timer); controller?.abort(); };
    }, [userId]);
}
