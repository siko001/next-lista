# Guest lists at login

Add `claim-guest-lists.php` to your existing WordPress snippets setup. If an earlier version is already active, replace its code instead of adding a second snippet. The app changes alone cannot transfer lists until this endpoint is active.

1. WordPress → Snippets → Add New → PHP snippet.
2. Name it **Lista — bring guest lists into account**.
3. Paste the contents of `claim-guest-lists.php`, omitting the opening `<?php` line if your snippets editor adds it.
4. Set it to **Run everywhere** (not admin-only), then save and activate.
5. Keep the existing JWT Authentication and ACF plugins active. The WordPress server must be able to make an HTTPS request to its own `/wp-json/wp/v2/users/me` endpoint.

No new ACF fields, tables, or changes to existing list endpoints are required. The plugin uses private `_lista_claimed_by` user metadata to bind safe retries to one destination account. It also repairs the `registered = yes` marker: the existing profile update hook skips it when registration changes the password. New registrations are marked when email and password change together. Existing accounts with a non-default password are repaired after their JWT has been verified.

## Flow

The frontend authenticates the account, but retains the guest session until its owned lists have transferred. Guests with no owned lists can log in normally without calling the transfer endpoint. Registration already upgrades the current guest account in place.

`POST /wp-json/custom/v1/claim-guest-lists`

- Authorization bearer: existing guest JWT.
- JSON body: `account_token`, the newly issued account JWT.
- The guest is authenticated by the existing JWT plugin. The account token is validated independently through WordPress `/users/me`; the client cannot nominate an arbitrary account ID.
- Moves the same list records, updates owner and author, and appends them after the account's existing lists. Products, checked/bagged state, share codes and recipients stay on those records.
- Shared-with-guest lists are not transferred: the guest does not own them.
- A lock prevents simultaneous requests for the same guest. Successful rows are skipped on retry; a partially completed handoff can only continue to the original destination. Nothing is deleted or copied.
- Account tokens are not saved in list metadata. The obsolete guest `owner_token` value is cleared on transferred lists.
- If the endpoint is absent or fails, the app keeps the guest cookie and displays an error instead of silently replacing the session. Any already-transferred records remain safely in the destination account and retries finish the remainder.

## Verify after installation

Using test accounts, make two guest lists with both checked and bagged products. Log into an account that already has a list. All three should appear, with the original contents and bagged state. Retry the same transfer and verify no duplicate list records. Also check an empty guest account logs in normally.

Local automated checks exercise the client handoff and the PHP endpoint with WordPress stubs. Actual JWT authentication, loopback access and installed WordPress hooks must be checked on the deployed site.
