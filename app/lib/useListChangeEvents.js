import {useEffect} from "react";
import {subscribePusherEvent} from "./pusherClient";
import {refreshListData} from "./dataCache.mjs";

// One account-level notification covers new lists and ordering as well as
// changes to existing lists. Fetch with this client's session, including when
// the writer is another device signed into the same account.
export default function useListChangeEvents(userId) {
    useEffect(() => {
        if (!userId) return;
        return subscribePusherEvent(`user-lists-${userId}`, "lists-changed", () => refreshListData(userId));
    }, [userId]);
}
