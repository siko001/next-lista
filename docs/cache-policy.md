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
