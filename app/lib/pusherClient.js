import Pusher from "pusher-js";
import {createSharedRealtime} from "./sharedRealtime.mjs";

let pusher;
const channelReferences = new Map();
let disconnectTimer;

export function getPusher() {
  if (!pusher) {
    // Pusher.logToConsole = false; // uncomment to debug
    pusher = new Pusher("a9f747a06cd5ec1d8c62", {
      cluster: "eu",
      forceTLS: true,
      enableStats: false,
    });
  }
  return pusher;
}

// Share one socket per tab. Each listener owns only its own event binding, so
// leaving one screen cannot remove another screen's listener on the same channel.
function subscribeDirectPusherEvent(channelName, eventName, handler) {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = undefined;
  }
  const client = getPusher();
  const channel = client.subscribe(channelName);
  channelReferences.set(channelName, (channelReferences.get(channelName) || 0) + 1);
  channel.bind(eventName, handler);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    channel.unbind(eventName, handler);
    const remaining = (channelReferences.get(channelName) || 1) - 1;
    if (remaining > 0) {
      channelReferences.set(channelName, remaining);
    } else {
      channelReferences.delete(channelName);
      client.unsubscribe(channelName);
    }
    if (channelReferences.size === 0) {
      // Avoid socket churn during React effect replacement and Strict Mode mounts.
      disconnectTimer = setTimeout(() => {
        disconnectTimer = undefined;
        if (channelReferences.size === 0) {
          client.disconnect();
          if (pusher === client) pusher = undefined;
        }
      }, 500);
    }
  };
}


let shared;
export function subscribePusherEvent(channelName, eventName, handler) {
  if (typeof window === "undefined" || !navigator.locks || typeof BroadcastChannel === "undefined") {
    return subscribeDirectPusherEvent(channelName, eventName, handler);
  }
  if (!shared) {
    shared = createSharedRealtime({
      createChannel: () => new BroadcastChannel("lista-remote-events-v1"),
      requestLock: (signal, run) => navigator.locks.request("lista-remote-connection-v1", {signal}, run),
      subscribeRemote: subscribeDirectPusherEvent,
    });
    window.addEventListener("pagehide", () => shared.pause());
    window.addEventListener("pageshow", () => shared.resume());
  }
  return shared.subscribe(channelName, eventName, handler);
}
