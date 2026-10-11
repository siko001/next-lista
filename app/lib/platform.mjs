// Browser defaults. The separate mobile build supplies its own implementation.
export const apiUrl = (path) => path;
export const publicOrigin = () => typeof window === "undefined" ? "" : window.location.origin;
export const navigate = (url, {replace = false} = {}) => {
    if (replace) window.location.replace(url);
    else window.location.href = url;
};
export const reloadPage = () => window.location.reload();
export const openExternal = (url) => window.open(url, "_blank", "noopener,noreferrer");
export const shareLink = async () => false;
export const copyText = (text) => navigator.clipboard.writeText(text);
export function sessionUserId() {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/(?:^|;\s*)id=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}
