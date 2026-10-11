import {forwardRef} from "react";
import {navigateRoute} from "./navigation.js";
import {openExternal, publicOrigin} from "../platform.js";
import {internalPath} from "../urls.mjs";

export default forwardRef(function Link({href, replace, scroll, prefetch, onClick, children, ...props}, ref) {
    return <a {...props} ref={ref} href={href} onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (props.target === "_blank" || !internalPath(href, publicOrigin(), window.location.origin)) void openExternal(href);
        else navigateRoute(href, {replace, scroll});
    }}>{children}</a>;
});
