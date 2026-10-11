import {useMemo, useSyncExternalStore} from "react";
import {internalPath} from "../urls.mjs";
import {openExternal, publicOrigin} from "../platform.js";

let revision = 0;
const event = "lista:route";
const publish = () => window.dispatchEvent(new Event(event));
const subscribe = (listener) => {
    window.addEventListener("popstate", listener);
    window.addEventListener(event, listener);
    return () => { window.removeEventListener("popstate", listener); window.removeEventListener(event, listener); };
};
const snapshot = () => `${window.location.pathname}${window.location.search}${window.location.hash}|${revision}`;
export const useLocation = () => useSyncExternalStore(subscribe, snapshot, snapshot);
export function navigateRoute(value, {replace = false, scroll = true} = {}) {
    const path = internalPath(value, publicOrigin(), window.location.origin);
    if (!path) { void openExternal(value); return; }
    const depth = history.state?.listaDepth || 0;
    history[replace ? "replaceState" : "pushState"]({listaDepth: replace ? depth : depth + 1}, "", path);
    publish();
    if (scroll) window.scrollTo(0, 0);
}
export const router = {
    push: (url, options) => navigateRoute(url, options),
    replace: (url, options) => navigateRoute(url, {...options, replace: true}),
    back: () => history.state?.listaDepth > 0 ? history.back() : navigateRoute("/", {replace: true}),
    forward: () => history.forward(),
    refresh: () => { revision++; publish(); },
    prefetch: () => {},
};
export const useRouter = () => router;
export function usePathname() { useLocation(); return window.location.pathname; }
export function useSearchParams() {
    const location = useLocation();
    return useMemo(() => new URLSearchParams(window.location.search), [location]);
}
export function useParams() {
    const path = usePathname();
    return useMemo(() => {
        const match = path.match(/^\/(?:list|shared-list)\/([^/]+)/);
        return match ? {id: decodeURIComponent(match[1])} : {};
    }, [path]);
}
