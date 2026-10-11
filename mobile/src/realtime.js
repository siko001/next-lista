import Pusher from "pusher-js";
import {refreshListData} from "../../app/lib/dataCache.mjs";
import {getCookie} from "./session.js";

let client;
const references = new Map();
let disconnectTimer;
function refreshCurrentLists() {
    const id = getCookie("id");
    if (!id) return;
    refreshListData(id);
}
export function getPusher() {
    if (!client) {
        client = new Pusher("a9f747a06cd5ec1d8c62", {cluster: "eu", forceTLS: true, enableStats: false});
        // Always recover authoritative data after a socket reconnect, including
        // events missed during a phone call, screen lock, or Wi-Fi transition.
        client.connection.bind("connected", refreshCurrentLists);
    }
    return client;
}
export function subscribePusherEvent(channelName, eventName, handler) {
    clearTimeout(disconnectTimer);
    const pusher = getPusher();
    const channel = pusher.subscribe(channelName);
    references.set(channelName, (references.get(channelName) || 0) + 1);
    channel.bind(eventName, handler);
    let released = false;
    return () => {
        if (released) return;
        released = true;
        channel.unbind(eventName, handler);
        const count = (references.get(channelName) || 1) - 1;
        if (count) references.set(channelName, count);
        else { references.delete(channelName); pusher.unsubscribe(channelName); }
        if (!references.size) disconnectTimer = setTimeout(() => {
            if (!references.size) { pusher.disconnect(); if (client === pusher) client = undefined; }
        }, 500);
    };
}
export function pauseRealtime() { client?.disconnect(); }
export function resumeRealtime() {
    if (references.size) client?.connect();
    refreshCurrentLists();
}
