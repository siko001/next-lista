# Store listing copy

Name: **Lista**

Short description (under 80 characters):

Shared shopping lists, voice input and meal ideas for your next shop.

Full description:

Keep your next shop organised with Lista. Create shopping lists, add what you need, and check items off as you go.

SHOP TOGETHER
Share a list by link and keep up with changes while you and your list members are connected. Use the same account on the Lista website and Android app.

MAKE LISTS YOUR WAY
Choose products, create custom items, save favourites and organise your shopping across multiple lists.

SPEAK YOUR SHOPPING LIST
Use optional voice input to turn spoken items into a list. Review the transcription and edit the items before adding them. Microphone permission is needed for recording.

GET MEAL IDEAS
Ask the AI assistant for recipe and meal suggestions, then review ingredients before adding them to your shopping. AI suggestions can make mistakes.

MAKE IT YOURS
Choose a light or dark appearance, or follow your device's theme.

Lista requires an internet connection for account data, synchronisation and AI features. Shared updates work while connected. Lists and voice features do not support full offline editing.

Support: neil.mallia1@gmail.com

## Console fields to review

- Suggested category: Shopping.
- Support email: `neil.mallia1@gmail.com`.
- Website: `https://next-lista.vercel.app`.
- Privacy URL after deployment: `https://next-lista.vercel.app/privacy`.
- Account deletion URL after deployment: `https://next-lista.vercel.app/delete-account`.
- Developer display name: **Neil Mallia** (confirmed by the developer on 11 October 2026).
- Price, countries, target audience and content-rating responses: owner decisions; do not infer an age rating from this draft.
- Ads: no ad SDK or advertising UI found in the app code reviewed. Confirm against the shipped dependencies/configuration before declaring.
- App access: create a dedicated ordinary account, confirm login works, and provide its credentials privately in Play Console's App access section. Include steps for lists, sharing, AI chat, voice and deletion. Do not put passwords in this repository.

## Initial release notes

Create and share shopping lists, check off items, save favourites, and try voice input and AI meal suggestions. This is Lista's initial Android testing release.

## Reviewer walkthrough

Use an ordinary reviewer account supplied privately in Play Console when available.
Guest mode can also exercise lists, sharing, favourites, AI and voice without an email.

1. Open Lista and create a list. Search for products or add a custom item.
2. Open a list, add items, and bag/unbag them. Reopen the list to confirm persistence.
3. Use Share to copy an invitation; accept it in a separate account. Invitations expire after 48 hours. Updates appear while both clients are online.
4. Open the assistant for meal suggestions. For voice, allow microphone access, speak items, stop and review the transcription before adding them.
5. Open Settings → Privacy policy or Delete account. Deletion requires reviewing the account and explicitly confirming it. Use a disposable account for that step.

The app requires internet access. It has no payment or subscription step. Social sign-in is not included in this release. Do not send review credentials through email or add them to source control.
