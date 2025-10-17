import Pusher from "pusher-js";

let pusher;

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
