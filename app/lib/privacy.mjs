export const DEVELOPER_NAME = "Neil Mallia";
export const SUPPORT_EMAIL = "neil.mallia1@gmail.com";
export const POLICY_UPDATED = "11 October 2026";
export const DELETION_DAYS = 30;
export const isPublicInfoPath = (path) => ["/privacy", "/delete-account"].includes(path.replace(/\/$/, ""));
export const deletionEmailUrl = `mailto:${SUPPORT_EMAIL}?${new URLSearchParams({
    subject: "Lista account and data deletion request",
    body: "Please delete my Lista account and its associated data.\n\nMy Lista account email: \n\nI understand that my owned shopping lists (including lists I shared), favourites and custom products will be removed. Please contact me to verify ownership before deletion.\n\nPlease do not include passwords in this email.",
}).toString().replace(/\+/g, "%20")}`;

// Assistant drafts/history are saved locally even after logging out. Only
// remove Lista assistant keys; leave authentication and other storage intact.
export function clearAssistantHistory(...stores) {
    for (const storage of stores) {
        for (let i = storage.length - 1; i >= 0; i--) {
            const key = storage.key(i);
            if (key?.startsWith("lista:assistant:")) storage.removeItem(key);
        }
    }
}
