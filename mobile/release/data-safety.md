# Data safety working inventory

This is a source-derived worksheet, not a completed declaration. Match it against the deployed backend, actual third-party account settings and Google's current definitions before submitting. Never mark "no data collected" for this app.

| Data | Where it goes / stays | Purpose | Required or optional |
| --- | --- | --- | --- |
| Email and display name | WordPress/Hostinger; account email service; names can appear to list collaborators | Account management, recovery, app functionality | Required when registering; guest mode exists |
| User ID, session credentials | WordPress; secure device storage on mobile; cookies on web; backend authentication | Account management, app functionality, security | Required to operate the service, including guest account IDs |
| List names, shopping items, favourites, custom products, memberships | WordPress/Hostinger; authorized shared list members | App functionality and synchronization | User-created content; required for used list features |
| Voice recording | Vercel voice endpoint → Groq transcription | Optional voice input | Optional; microphone permission |
| Voice transcript | Groq extraction; response and local voice draft; products stored when added | App functionality | Optional |
| AI messages and recent conversation | Vercel → OpenAI if configured, otherwise Groq | Recipe/chat responses | Optional |
| Assistant history and voice drafts | Local storage; up to recent conversation context is sent when asking the AI | App functionality | Optional; deletion page clears local history |
| Page text for translation | Google Translate | Translation | Language feature; loads after selecting a non-English language, or when restoring that choice |
| IP address and service request metadata | Hosting/AI/translation infrastructure | Delivery, operations, security | Provider-dependent; inspect logging/retention |
| Theme/language settings | Local device/browser storage | Personalization | On-device unless otherwise exposed through translated requests |

Likely form categories to evaluate: Personal info (name, email, user IDs); Audio files (voice recordings); App activity / Other user-generated content (lists, messages and transcripts). Device/other IDs and diagnostics depend on actual provider collection. Do not classify shopping-list items as completed purchases or claim precise location is collected without evidence.

"Collected" includes sending data off the device to a processor, even if Lista does not retain it. "Shared" has specific exemptions for service providers and certain user-initiated transfers; evaluate each provider relationship rather than mechanically answering Yes or No. Ephemeral processing is only applicable if the full processing/retention chain meets Google's definition. On-device-only history is not itself off-device collection, but message context sent with an AI request is.

Transport uses HTTPS/TLS in the reviewed mobile configuration. Verify every deployed endpoint and SDK before declaring that all user data is encrypted in transit. A missing authorization check is a separate security defect that must be fixed even if transport is encrypted.

Deletion: authenticated self-service removal is available in the new app for guests and registered accounts, with an explicit confirmation. The matching public page also provides an email fallback without requiring sign-in or reinstalling; verified email requests are targeted within 30 days. Public web deployment is still pending. Backups, request audit records, provider logs and AI retention must be documented against actual settings. Never claim "zero retention" or "not used for training" without verifying the specific provider account configuration.

Source: [Google Play Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).


## Draft form choices supported by this implementation

- **Data collected:** Yes. Email/name/user IDs, shopping content, optional AI messages and optional voice are transmitted off-device.
- **Account creation:** Email and password; anonymous guest identifiers are also created. Do not declare OAuth/social sign-in for this release.
- **Deletion:** Yes, with the published `/delete-account` URL once deployment is verified. It covers the account and associated data; optional requests for particular data can also be emailed.
- **Encryption in transit:** Reviewed configured endpoints use HTTPS. Recheck after deployment and after any SDK/provider change.
- **Purposes:** App functionality and account management; operational metadata also supports security and abuse prevention. No advertising purpose found.
- **Required/optional:** Guest ID and stored lists are intrinsic to the used features. Registered email/name, voice, AI conversation and translation are optional because guests can use typed lists.
- **Sharing and ephemeral processing:** Confirm against Google's definitions and each provider's contract/retention settings; no unverified "not shared", "ephemeral" or "zero retention" declaration is prepared.

The app contains no reviewed advertising or analytics SDK. Host-side WordPress plugins and hosting logs must still be checked. The retired Pusher plugin is inactive and version 0.1.2 contains no Pusher client dependency. The old credential should be revoked in its provider account.
