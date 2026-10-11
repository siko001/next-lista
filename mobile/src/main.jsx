import React from "react";
import {createRoot} from "react-dom/client";
import {Capacitor} from "@capacitor/core";
import {SplashScreen} from "@capacitor/splash-screen";
import App, {ErrorScreen} from "./App.jsx";
import {initializeSession} from "./session.js";
import {initializeRuntime} from "./runtime.js";
import "@fontsource-variable/saira/wght.css";
import "@fontsource-variable/quicksand/wght.css";
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
import "../../app/globals.css";
import "../../app/css/list-pages.css";
import "../../app/css/page-skeleton.css";
import "../../app/css/auth.css";
import "../../app/css/settings.css";
import "../../app/css/not-found.css";
import "./mobile.css";

const root = createRoot(document.getElementById("root"));
async function startApp() {
    try {
        await initializeSession();
        const dispose = await initializeRuntime();
        if (import.meta.hot) import.meta.hot.dispose(dispose);
        // The shared session provider creates guest accounts. Mount it once;
        // StrictMode's development effect replay must not create duplicate guests.
        root.render(<App />);
    } catch {
        root.render(<ErrorScreen message="Lista couldn’t open its secure session. Unlock your phone and try again." />);
    } finally {
        if (Capacitor.isNativePlatform()) void SplashScreen.hide();
    }
}

// Finish evaluating this module before awaiting plugin initialization. Native
// storage lazily imports a chunk that shares exports from this entry chunk;
// top-level await would make each chunk wait for the other indefinitely.
void startApp();
