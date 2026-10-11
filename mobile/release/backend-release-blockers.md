# Backend release status — 11 October 2026

The live WPCode export, rather than the older WP folder, was used as the baseline. Original snippets and the retired realtime plugin are backed up privately under ignored `mobile/.cache/wp-live-2026-10-11/`. These checks are not a complete penetration test.

## Applied and verified

- Snippet **1764** enforces owner/member access on custom list operations, validates reorder batches, restricts custom-product deletion, validates membership changes and removes credentials from responses.
- Snippet **1769** creates guests with unique credentials, issues session tokens directly, denies the historical shared guest password, and restricts app accounts to the `lista_member` role. Existing app sessions and registered passwords are preserved. WordPress showed **212 Lista members and one administrator**, with no editor accounts remaining, after migration.
- The same patch protects native shopping-list REST routes and user profile registration, blocks user enumeration/ACF mass assignment, hides private content from public WordPress views/search/sitemaps, and disables the two unverified legacy Google account endpoints. Social sign-in is not included in the release.
- Invitation codes contain 24 random characters, expire after 48 hours, and are invalidated when a member is removed.
- Guest custom products and favourites move with owned lists when signing in to an existing registered account. Fresh favourites now persist without relying on ACF field-reference metadata.
- Private synchronization uses an authenticated, per-account revision marker. List contents are fetched through authorized REST routes. The old **Lista Realtime Updates plugin is inactive**, snippets 215/1036/1038/1045 use a no-op compatibility sink, and snippet **1774** keeps legacy callers working. No old public channel receives new list payloads through these publishers.
- Self-service deletion removes the app account, owned lists/products, membership in others' lists, affected product references/favourites, and invalidates old tokens. Unrelated lists survive. The client requires explicit confirmation and offers an email fallback.
- The quota endpoint enforces 40 guest / 120 registered assistant requests per account per hour. Guest creation is limited to 20 per source IP per hour; account lookup/reset requests are limited too. The prepared Vercel routes must be deployed to enforce this before paid AI requests. These limits do not replace infrastructure-wide billing/abuse controls.

**Evidence:** 71 local route checks, 46 account checks, 41 live route checks and a final 67-check live privacy/deletion rehearsal. The last run's accounts 811–813, lists 1794–1796 and products 1797–1799 were all deleted as test fixtures. No existing customer account was deleted. Exact sources and deployment instructions are in `WP/security/README.md`.

## Still outstanding

1. **Deploy the web client and AI endpoints to Vercel.** The current production website has not received these source changes. Older clients can still load/save through the secured API but no longer receive old public-channel updates. Verify the public privacy/deletion URLs signed out after deployment.
2. **Retire the exposed Pusher credential in the Pusher account.** Current repository source/archive and the new app no longer contain/use it; the inactive live plugin, private backup and Git history can still contain the old value. No provider-side revocation has been verified.
3. **Confirm actual backup/log/provider retention settings and Data safety answers.** Do not claim zero retention, no training, or ephemeral processing without the corresponding provider-account evidence. Email requests still require ownership verification and fulfilment within the owner-approved 30-day target.
4. **Physical-device acceptance of version 0.1.2**, then Play internal-test/pre-launch checks. The previous version's microphone worked on the owner's phone; version 0.1.2/code 3 is now installed there in place, with data preserved.
5. **Google verification and Console setup:** identity verification is pending; phone verification and app creation are locked behind it. No Play upload or release has occurred.

The production npm audit reports zero vulnerabilities in both the shared application and mobile runtime dependency trees. Development-only lint tooling still has upstream glob/parser advisories; it is not part of the app bundle. Avoid processing untrusted patterns through that tooling and revisit when compatible fixes are published.
