"use client";

import {useCallback, useEffect, useState} from "react";
import {getTranslation, rememberTranslation} from "./domTranslations.mjs";

export default function useDomTranslations() {
    const [language, setLanguage] = useState("en");
    const [, setRevision] = useState(0);

    useEffect(() => {
        const syncLanguage = () => {
            setLanguage(localStorage.getItem("preferredLanguage") || "en");
        };
        syncLanguage();
        window.addEventListener("lista:language-changed", syncLanguage);
        window.addEventListener("storage", syncLanguage);
        return () => {
            window.removeEventListener("lista:language-changed", syncLanguage);
            window.removeEventListener("storage", syncLanguage);
        };
    }, []);

    useEffect(() => {
        if (language === "en") return;
        let frame = null;
        const collect = () => {
            frame = null;
            const widgetLanguage = document.querySelector(".goog-te-combo")?.value;
            if (widgetLanguage && widgetLanguage !== language) return;
            let changed = false;
            document.querySelectorAll("[data-lista-translate-key]").forEach((element) => {
                const key = element.getAttribute("data-lista-translate-key");
                const original = element.getAttribute("data-lista-source") || "";
                const rendered = element.textContent.trim();
                if (rememberTranslation(language, key, original, rendered)) changed = true;
            });
            if (changed) setRevision((value) => value + 1);
        };
        const schedule = () => {
            if (frame === null) frame = requestAnimationFrame(collect);
        };
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, {subtree: true, childList: true, characterData: true});
        schedule();
        return () => {
            observer.disconnect();
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, [language]);

    const text = useCallback((key, original) => getTranslation(language, key) || original, [language]);
    return {language, text};
}
