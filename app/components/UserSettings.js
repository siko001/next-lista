"use client";

import {useState, useEffect, useRef, useId} from "react";
import {createPortal} from "react-dom";
import {Check, ChevronDown, Globe, Monitor, Moon, Settings2, Sun, X} from "lucide-react";
import gsap from "gsap";
import {changeLanguage, initGoogleTranslate} from "../utils/translate";
import {useListContext} from "../contexts/ListContext";
import {createSmoothScroller} from "../lib/smoothScroll";

const LANGUAGES = {en: "English", mt: "Maltese", it: "Italian", es: "Spanish", fr: "French", de: "German", pt: "Portuguese"};
const THEMES = [{value: "light", label: "Light", Icon: Sun}, {value: "system", label: "System", Icon: Monitor}, {value: "dark", label: "Dark", Icon: Moon}];

function updateTheme(preference) {
    const dark = preference === "dark" || (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    const resolved = dark ? "dark" : "light";
    const root = document.documentElement;
    root.classList.remove("light", "dark", "light-mode", "dark-mode");
    root.classList.add(resolved, `${resolved}-mode`);
    root.style.colorScheme = resolved;
}

export default function UserSettings({isOpen, onClose}) {
    const [theme, setTheme] = useState("system");
    const [currentLanguage, setCurrentLanguage] = useState("en");
    const [languageError, setLanguageError] = useState("");
    const [isVisible, setIsVisible] = useState(false);
    const modalRef = useRef(null);
    const backdropRef = useRef(null);
    const scrollRef = useRef(null);
    const closeRef = useRef(onClose);
    const initialized = useRef(false);
    const {lenis} = useListContext();
    const titleId = useId();
    const languageId = useId();
    closeRef.current = onClose;

    useEffect(() => {
        const saved = localStorage.getItem("theme") || "system";
        setTheme(saved);
        updateTheme(saved);
        setCurrentLanguage(localStorage.getItem("preferredLanguage") || "en");
        const media = matchMedia("(prefers-color-scheme: dark)");
        const sync = () => {
            if ((localStorage.getItem("theme") || "system") === "system") updateTheme("system");
        };
        media.addEventListener("change", sync);
        if (!initialized.current) {
            initGoogleTranslate();
            initialized.current = true;
        }
        return () => media.removeEventListener("change", sync);
    }, []);

    useEffect(() => { if (isOpen) setIsVisible(true); }, [isOpen]);

    useEffect(() => {
        if (!isVisible) return;
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const timeline = gsap.timeline();
        if (isOpen) {
            timeline.fromTo(backdropRef.current, {opacity: 0}, {opacity: 1, duration: reduced ? 0 : .25})
                .fromTo(modalRef.current, {opacity: 0, y: 20, scale: .97}, {opacity: 1, y: 0, scale: 1, duration: reduced ? 0 : .38, ease: "power3.out"}, 0);
        } else {
            timeline.to(modalRef.current, {opacity: 0, y: 12, scale: .98, duration: reduced ? 0 : .24, ease: "power2.inOut"})
                .to(backdropRef.current, {opacity: 0, duration: reduced ? 0 : .24}, 0)
                .call(() => setIsVisible(false));
        }
        return () => timeline.kill();
    }, [isOpen, isVisible]);

    useEffect(() => {
        if (!isVisible) return;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        const rootScroller = lenis?.current;
        const wasStopped = rootScroller?.isStopped;
        rootScroller?.stop();
        document.body.style.overflow = "hidden";
        const scroll = createSmoothScroller({wrapper: scrollRef.current, content: scrollRef.current.firstElementChild, overscroll: false});
        modalRef.current.querySelector("button")?.focus({preventScroll: true});
        const onKeyDown = (event) => {
            if (event.key === "Escape") closeRef.current();
            if (event.key !== "Tab") return;
            const controls = [...modalRef.current.querySelectorAll('button, select, a[href], [tabindex="0"]')].filter(node => !node.disabled);
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && (document.activeElement === first || !modalRef.current.contains(document.activeElement))) {
                event.preventDefault(); last?.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !modalRef.current.contains(document.activeElement))) {
                event.preventDefault(); first?.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            scroll.destroy();
            document.body.style.overflow = previousOverflow;
            if (!wasStopped) rootScroller?.start();
            document.removeEventListener("keydown", onKeyDown);
            if (previousFocus?.isConnected) previousFocus.focus({preventScroll: true});
        };
    }, [isVisible, lenis]);

    const applyTheme = (preference) => {
        localStorage.setItem("theme", preference);
        setTheme(preference);
        updateTheme(preference);
    };
    const handleLanguageChange = (language) => {
        if (language === currentLanguage) return;
        try {
            changeLanguage(language);
            setCurrentLanguage(language);
            localStorage.setItem("preferredLanguage", language);
            setLanguageError("");
        } catch {
            setLanguageError("We couldn't change the language. Please try again.");
        }
    };

    if (!isVisible) return null;
    return createPortal(
        <div className="settings-overlay">
            <div ref={backdropRef} className="settings-backdrop" onClick={onClose} aria-hidden="true" />
            <section ref={modalRef} className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <header className="settings-heading">
                    <span className="settings-emblem"><Settings2 size={23} aria-hidden="true" /></span>
                    <button className="settings-close" onClick={onClose} aria-label="Close settings"><X size={20} /></button>
                    <p className="settings-eyebrow">MAKE IT YOURS</p>
                    <h2 id={titleId}>Your preferences</h2>
                    <p>A little more you. A little more Lista.</p>
                </header>
                <div ref={scrollRef} className="settings-scroll" data-lenis-prevent>
                    <div className="settings-sections">
                        <section className="settings-section" aria-labelledby={`${titleId}-appearance`}>
                            <h3 id={`${titleId}-appearance`}>Appearance</h3>
                            <p>Choose your look, or follow your device.</p>
                            <div className="settings-themes" role="group" aria-label="Colour theme">
                                {THEMES.map(({value, label, Icon}) => (
                                    <button key={value} className={`settings-theme ${theme === value ? "is-selected" : ""}`} aria-pressed={theme === value} onClick={() => applyTheme(value)}>
                                        <span className={`settings-theme-preview preview-${value}`} aria-hidden="true"><span /><span /><span /></span>
                                        <span className="settings-theme-label"><Icon size={16} aria-hidden="true" />{label}<Check size={15} className="settings-theme-check" aria-hidden="true" /></span>
                                    </button>
                                ))}
                            </div>
                        </section>
                        <section className="settings-section">
                            <label htmlFor={languageId}>Language</label>
                            <p id={`${languageId}-hint`}>Feel at home in your preferred language.</p>
                            <div className="settings-language">
                                <Globe size={19} aria-hidden="true" />
                                <select id={languageId} value={currentLanguage} onChange={event => handleLanguageChange(event.target.value)} aria-describedby={`${languageId}-hint`}>
                                    {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                                </select>
                                <ChevronDown size={17} aria-hidden="true" />
                            </div>
                            {languageError && <p className="settings-error" role="alert">{languageError}</p>}
                        </section>
                    </div>
                </div>
                <footer className="settings-footer"><span><Check size={15} aria-hidden="true" />Saved automatically</span><button className="app-primary-action" onClick={onClose}>Done</button></footer>
            </section>
        </div>, document.body
    );
}
