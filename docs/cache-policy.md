# Lista cache policy

The browser cache lives in `sessionStorage` with an in-memory copy. Keys use user IDs, never JWTs, and private responses are stripped of token and password fields before storage. Requests in progress are deduplicated. Invalidation also reaches other open tabs through `BroadcastChannel`. WordPress is always authoritative after an entry expires or is invalidated.

| Data | Lifetime | Refresh rule |
| --- | ---: | --- |
| Core product catalogue | 10 minutes in browser and Next server data cache | Expiry; core products added through a future Lista action should invalidate `catalogue` |
| Custom products | 5 minutes per account | Create/delete and expiry; checked again when product picker opens |
| Favourites | 2 minutes per account | Add/remove and expiry; checked again when product picker opens |
| Account label | 5 minutes per account | Login/logout/register; WordPress still validates the token on every page load |
| Home list summaries | 30 seconds per account | Create/copy/rename/delete/reorder, list product changes, sharing and realtime events |
| Individual list contents and access | No persistent cache | Fresh server request on navigation; local state and realtime events update the open page |
| Login, register, password reset, invite acceptance, email availability | No data cache | Always request or validate fresh data |

`app/lib/dataCache.mjs` owns TTLs and invalidation. Private entries are cleared on logout and guest-to-account login. The home page reuses the server's list response instead of immediately requesting the same data again. Optimistic product changes invalidate before the write and again when the server confirms, so a read during a write cannot leave an old result warm.

WordPress product edits made outside Lista have no client event. The catalogue updates after the browser and server TTLs expire; a recently reused server snapshot can extend the wait beyond 10 minutes. No WordPress snippet is required for this cache layer.


Same-browser tabs now refresh their visible lists when an account-scoped cache invalidation arrives over BroadcastChannel. Receivers coalesce bursts and discard obsolete reads; receiving an invalidation does not broadcast it again. This works independently of the WebSocket connection.

Remote live sharing remains enabled. On browsers with Web Locks and BroadcastChannel, one tab owns the Pusher connection and forwards remote events to the other tabs. Channel subscriptions include every participating tab, and ownership transfers when that tab closes or refreshes. Browsers without these APIs retain the existing per-tab connection. This reduces duplicate connections and deliveries; WordPress still publishes remote events for shared-list collaboration.

The optional ambient desktop easter egg uses a separate local BroadcastChannel for ephemeral window positions. It renders a faint Lista-green connection only when two or more visible desktop views are nearby, and stops for hidden views, mobile/touch layouts, or reduced-motion preferences. It makes no server or WebSocket requests and writes no positions to storage. It works within the same origin and browser profile; webpages cannot draw in the desktop gap outside their viewports.
