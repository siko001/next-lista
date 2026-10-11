# Lista Google Play release kit

Prepared on **11 October 2026** for **Neil Mallia**. Package `app.lista.shopping`; Android **0.1.2**, version code **3**, target SDK **36**. Contact: `neil.mallia1@gmail.com`.

**Status:** The backend and website privacy fixes are live, the signed testing bundle is built, and version 0.1.2 is installed on the owner’s phone with data preserved. Google Play submission remains pending. Google is verifying the developer's identity; phone verification and app creation are locked behind that step. No app has been uploaded or published.

## Files to use

| Purpose | File |
| --- | --- |
| Google Play upload | `mobile/artifacts/Lista-release.aab` |
| Update the existing debug installation | `mobile/artifacts/Lista-debug.apk` |
| Icon, feature graphic, three phone screenshots | `mobile/artifacts/google-play/` |
| Store description and reviewer walkthrough | `mobile/release/store-listing.md` |
| Data safety worksheet | `mobile/release/data-safety.md` |
| Backend deployment and remaining issues | `mobile/release/backend-release-blockers.md` and `WP/security/README.md` |

The icon is 512×512, the feature graphic 1024×500, and the screenshots 1080×1920. Screenshots use representative demonstration data in the actual shared mobile UI; they are browser-rendered UI, not physical Android OS captures. The feature graphic is an illustration. No private user data is included.

Upload only the `.aab` to Play. The ignored `mobile/.signing/` directory contains the upload key and password configuration: **back up that entire directory securely**, separate from the laptop. Never upload it as a store asset or commit it. Use Play App Signing for the distribution key.

## What changed

- Unique guest credentials and a restricted app role replace the shared guest password and WordPress editor privileges. Existing sessions and registered passwords are preserved.
- Private list permissions cover custom and native REST routes. Invitations expire after 48 hours and are revoked on member removal.
- Authenticated revision checks replace public Pusher list broadcasts. Both web and Android need the updated client for live synchronization.
- Guests and registered users can review and explicitly confirm account deletion in the new app. The web deletion page also accepts email requests without login/reinstallation, with the owner-approved 30-day target after ownership verification.
- Favourites persist for fresh guest accounts, and guest lists/products/favourites transfer to an existing registered account.
- AI chat and voice use authenticated account quotas before paid provider calls. Those hosted route changes are deployed on Vercel.
- Privacy information names Neil Mallia and the configured processors. Translation loads only after a non-English choice, including a saved choice. Microphone permission remains optional.
- Next.js/authentication and affected runtime dependencies are patched. Unused Pusher/Auth.js adapter packages were removed.

## Verification record

- **67 shared JavaScript tests**, **11 mobile unit tests**, **71 PHP route checks**, **46 PHP account checks**, and the legacy rename-call compatibility check passed.
- **3 production-bundle startup tests** passed, including Android/iOS bridge simulations and privacy access during secure-storage failure.
- **41 live route checks** passed. The final **67 live account/privacy/deletion checks** passed with disposable accounts only; all final rehearsal fixtures were deleted. These include real quota exhaustion without paid AI calls, login/transfer, token rejection after deletion and preservation of unrelated lists.
- WordPress's role summary showed **212 Lista members and one administrator** after migration; no editor accounts remained.
- Website production build passed with Next.js **15.5.27**. Four existing `HomeClient.js` hook-dependency warnings remain.
- APK and signed AAB built successfully. APK signature and JAR signature verification passed. Both manifests have the audio permissions; release is not debuggable. Neither archive includes native `.so` libraries. Play's own bundle/pre-launch checks remain pending.
- Production npm audits report **zero known vulnerabilities** for both the shared application and native mobile runtime dependencies. Development-only lint tooling has unresolved upstream pattern-parser advisories.
- No configured server-secret values were found in the public mobile or website JavaScript/JSON/HTML bundles.
- Version 0.1.1/code 2 was previously installed in place on the owner's A059 phone running Android 16; the owner confirmed microphone recording/transcription. Version 0.1.2/code 3 was installed in place on 11 October at 13:51 Malta time and reopened; Android reported the expected version and existing installation data was preserved. Physical acceptance of the updated privacy flows remains pending.

See `verification.json` for artifact hashes and the final UI result. These checks are evidence for release preparation, not proof of policy approval or a complete security audit.

## Website deployment and Vercel setup

The `feature/mobile-app` branch was fast-forwarded into `main` and pushed. Vercel built commit `5275d9f` successfully in the existing `next-lista` project. Both [privacy](https://next-lista.vercel.app/privacy) and [account deletion](https://next-lista.vercel.app/delete-account) return HTTP 200. Both AI routes return HTTP 401 for absent and invalid sessions; these four checks did not request a paid AI call. Quota exhaustion was verified against the live WordPress endpoint and the hosted guard logic in unit tests.

Following [Vercel’s agent setup guide](https://vercel.com/get-started.md), global CLI 63.1.2 is authenticated as `siko001`. The official Codex marketplace plugin is installed and enabled, including its status command source. A single user-wide MCP entry in `~/.codex/config.toml` points to `https://mcp.vercel.com`; OAuth succeeded and write tools require confirmation. Its duplicate plugin server is disabled. A new Codex session/reload is still needed to load the new commands/tools: `search_vercel_documentation` and authenticated `list_teams` were not available in the running chat, so those final MCP checks are not yet verified. This does not affect the completed website deployment.

## Next actions, in order
1. **Revoke the old Pusher credential** in its provider account. Its live plugin is inactive and current source/archive no longer contains it, but old history and backups can retain the credential.
2. **Confirm provider/log/backup retention** and finish the Data safety worksheet against the deployed configuration. Do not declare zero retention or ephemeral processing without evidence. Decide price, countries and intended audience before answering those Console fields; the content rating comes from Google's questionnaire.
3. **Check the updated APK already installed on the phone.** Check microphone, list persistence after restarting, sharing with a second account, remote changes, privacy/deletion access and offline/reconnect behavior.
4. **Finish Google's identity/phone/device verification.** Create Lista in Play Console, select the app name/language/category, add support information and the prepared listing/assets, complete app access, content rating, audience, ads and Data safety. Use a dedicated ordinary reviewer account; never administrator credentials.
5. **Upload `Lista-release.aab` to internal testing**, inspect Play's compatibility/pre-launch results and install from Play. The Play signature differs from the debug signature: do not silently uninstall the debug app or erase guest data to switch builds. First confirm data is saved in a registered account.
6. **Run closed testing with real participants.** New personal accounts require at least 12 opted-in testers continuously for 14 days before requesting production access. Internal testing and multiple accounts operated by one person do not establish that participation. Record real feedback and fixes for the production-access application.

## Email deletion requests

The new app can delete the signed-in guest or registered account directly. The email route remains available when a user has uninstalled the app or needs help:

1. Verify ownership through the registered email or an agreed alternative; never request a password. Do not delete based solely on an address typed into a message.
2. Find the correct app account. Account ownership uses `owner_id` for lists and `product_owner` for custom products; deleting only a WordPress user is insufficient.
3. Remove owned lists, trash/revisions and metadata; remove membership in others' lists while retaining their unrelated content. Delete owned custom products and their list/favourite references, update counts, remove the profile/favourites and account, and ensure old sessions no longer authenticate. An administrator should not be assigned the deleted private data.
4. Verify a second account cannot access the deleted list and its unrelated lists still work. Check other configured services and ensure restored backups do not resurrect completed deletions.
5. Reply within the stated 30-day target, explaining any legitimate retained records and their actual retention periods. Saved assistant history must also be cleared on each device; keep only the minimal necessary request audit record.

## Commands

```sh
node --test tests/*.test.mjs
npm --prefix mobile test
npm --prefix mobile run test:ui
npm --prefix mobile run test:packaged
php tests/wordpress-route-guards.php
php tests/wordpress-account-privacy.php
LISTA_NEXT_BUILD_DIR=.next-release npm run build
npm --prefix mobile run apk
npm --prefix mobile run bundle
```

Signing is already configured locally. `npm --prefix mobile run signing:setup` is first-time-only and refuses to replace an existing key. The debug key is separate and retained under ignored `mobile/.cache/` so `adb install -r` can update the current test installation.

## Official references checked on 11 October 2026

- [Target SDK requirement: API 36 for new phone apps](https://developer.android.com/google/play/requirements/target-sdk)
- [New personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Data safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Store graphics](https://support.google.com/googleplay/android-developer/answer/9866151)
