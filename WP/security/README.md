# Lista account and list privacy deployment

Applied on 11 October 2026 against the live WPCode export. Existing snippets were preserved except for the exact targeted updates below. Local `WP/` files outside this directory may be older than production; do not import the whole folder.

## Active deployment

| ID | Name / purpose | Exact source |
| --- | --- | --- |
| 1764 | Lista REST Permission Guards — October 2026 | `lista-route-guards.php` |
| 1769 | Lista Guest Accounts & Private Sync — October 2026 | `lista-privacy-deployment.php` |
| 1774 | Lista Private Sync Compatibility — October 2026 | `lista-legacy-event-compat.php` |
| 215, 1036, 1038, 1045 | Retire public event publishers | `updated-snippets/<id>.php` |
| 1400 | Strong invitation code and real expiry | `updated-snippets/1400.php` |
| 1619 | Explicit guest/registered transfer validation | `updated-snippets/1619.php` |

All three added snippets are PHP, Auto Insert, **Run Everywhere**, priority 10 and Active. Saved editor code was compared with the local deployment sources; trailing whitespace in archived snippets 1038 and 1619 was normalized before commit. The 1764 source hash remains `3383924aebd87cfcefaf9f1c07fc03dc503fba05acef5d2c087002ef5538dfa9`.

- [Permission guards](https://yellowgreen-woodpecker-591324.hostingersite.com/wp-admin/admin.php?page=wpcode-snippet-manager&snippet_id=1764)
- [Account privacy and deletion](https://yellowgreen-woodpecker-591324.hostingersite.com/wp-admin/admin.php?page=wpcode-snippet-manager&snippet_id=1769)
- [Legacy compatibility](https://yellowgreen-woodpecker-591324.hostingersite.com/wp-admin/admin.php?page=wpcode-snippet-manager&snippet_id=1774)

The old **Lista Realtime Updates** plugin (`lista-web-sockets/lista-realtime-updates.php`) is **deactivated**. Editing its live file was rejected by WordPress's loopback safety check; the replacement was therefore deployed as compatibility snippet 1774. Do not reactivate the original plugin: it would restore public broadcasts and conflict with the compatibility functions. Its original source is backed up privately. The small sanitized repository ZIP is a legacy no-op helper, not the full privacy deployment and not a replacement for snippet 1769.

## Deployment source

`lista-privacy-deployment.php` combines `lista-account-privacy.php`, `lista-private-sync.php` and `lista-account-deletion.php`. Each section has a function-existence wrapper because WPCode evaluates saved code in the current request. Update the separate sources and regenerate the combined file before deployment. Keep 1764 active: the account patch depends on its ID/access helpers.

Remove only the opening `<?php` when pasting into the PHP editor. Select **PHP Snippet** explicitly and verify **Run Everywhere**; Site Wide Header does not execute on REST requests. Verify Active and exact saved content after updating. Back up the existing source privately first. A simple copy/paste through CodeMirror works; overwriting its DOM content bypasses the editor's internal model and can corrupt the saved snippet.

## Coverage and verification

- Owner/member list reads and mutations; outsider/anonymous denial; whole-batch reordering; product type/ownership; member removal and invitation expiry/revocation.
- Server-derived ownership, protected native REST/ACF fields, least-privilege roles and unique guest credentials. Password login for guests is denied; current JWT sessions are preserved. Older clients receive a one-use, 120-second random login ticket for compatibility.
- Guest registration/login/transfer, custom products and favourites; fresh favourites persist using normalized user-meta IDs.
- Authenticated revision markers without list payloads; client requests then pass the same membership checks as ordinary reads. Removed members lose access on the next check. Already downloaded content cannot be recalled from their devices.
- Authenticated self-service deletion with explicit confirmation, protected administrator accounts, removal of owned data and surviving-list references. A per-account lock prevents duplicate erasers; a deletion marker blocks new requests while cleanup runs. Failures report an error for retry rather than a false success.
- Assistant account quota and request limits; corresponding paid-provider enforcement is now deployed to Vercel.

Validation completed:

- **71** local route authorization checks and **46** local account/favourite checks; PHP syntax valid.
- **41** live route integration checks, including one-use ticket consumption/replay rejection.
- **67** final live guest/privacy/transfer/quota/deletion checks. Report: `mobile/.cache/account-privacy-1791718171442.json`. Test accounts **811–813**, lists **1794–1796**, products **1797–1799** were deleted. Tokens were removed from the completed report.
- Earlier rehearsal fixtures were also cleaned. Initial route-test runs retained empty test users 797–800 and trashed lists, as recorded in their private reports. They are not real tester participation.
- WordPress's user-role summary showed **212 Lista members and one administrator** after migration. Existing registered passwords remain unchanged.
- The owner confirmed ordinary list loading/bagging after the initial 1764 patch. Physical version 0.1.2 acceptance is pending.

```sh
php tests/wordpress-route-guards.php
php tests/wordpress-account-privacy.php
# Creates disposable live fixtures and deletes only those fixtures:
node mobile/scripts/check-live-account-privacy.mjs --create-and-delete-test-accounts
```

The old route runner (`check-live-wordpress-guards.mjs --create-test-data`) retains empty test accounts in its audit record. Do not rerun without a reason to create additional fixtures. None of these checks constitutes a complete security audit or proves the absence of historical data exposure.

## Recovery and remaining work

Correct a regression in the affected snippet while retaining the authorization boundary. Disabling 1769 also removes routes required by the new clients and does not reverse migrated roles/passwords. Disabling 1764 reopens known access-control gaps. Do not describe either as a harmless rollback. Use the private backups for an identified, reviewed recovery; avoid restoring old guest passwords, editor roles or public publishing.

See `mobile/release/backend-release-blockers.md` for Vercel deployment evidence and remaining Pusher credential revocation, retention confirmation, physical-device checks and Google verification. No Google Play submission has occurred.
