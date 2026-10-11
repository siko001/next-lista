# Lista Sync Events

An additive WordPress plugin for Lista's existing REST endpoints and Pusher setup.
It notifies the owner, collaborators, and acting account after a successful list
write. It covers creation, ordering, renaming, deletion, copying, guest transfers,
sharing, and list product changes. Former recipients are retained before a
deletion or sharing removal so their open screens can clear revoked access.

The plugin does not replace endpoint handlers or change their responses. It
reuses `setup_pusher()` from the existing Lista Realtime Updates plugin and ACF
fields. No additional credentials are needed. Each `user-lists-{id}` channel
receives `lists-changed` with an event UUID only. Updated clients then fetch
authorized data using their own session. Notifications are coalesced per account
and emitted at request shutdown, after the write has completed.

## Install

1. Keep the existing Lista Realtime Updates plugin and ACF active.
2. In WordPress, open **Plugins → Add New Plugin → Upload Plugin**.
3. Upload `lista-sync-events.zip`, install, and activate **Lista Sync Events**.
4. Deploy the matching Lista web code and install the updated mobile APK.

Older clients safely ignore the added event. Updated clients can still consume
the previous events. Creation and ordering require this plugin on the server;
updating only the APK or website does not enable their missing notifications.

If WordPress displays a missing `setup_pusher()` notice, check that the existing
realtime plugin is active. Publish failures are logged without credentials or
list contents. Deactivating this plugin stops only the added notifications.

## Verify

Keep two devices signed into the same account with Lista open. Create a list on
each device, reorder in both directions, and rename an open list from each side.
Bag/unbag a product and verify the other screen changes without navigation or
refresh. Repeat with a collaborator account and test access removal. Reconnect
after a disconnection to verify recovery of missed events.

Local server-hook regression checks: `php tests/list-sync-events.php` from the
repository root. The mobile browser suite mocks WordPress and Pusher; a real
deployment/device check is still required after installation.

Hook reference: [WordPress rest_request_after_callbacks](https://developer.wordpress.org/reference/hooks/rest_request_after_callbacks/).
