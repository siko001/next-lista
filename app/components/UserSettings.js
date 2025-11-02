"use client";

import {useState, useEffect, useRef, useCallback} from "react";
import dynamic from "next/dynamic";
import {Globe} from "lucide-react";
import {changeLanguage, initGoogleTranslate} from "../utils/translate";

// Dynamically import the X icon with no SSR
const X = dynamic(() => import("lucide-react").then((mod) => mod.X), {
    ssr: false,
});

const LANGUAGES = {
    en: "English",
    mt: "Maltese",
    it: "Italian",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
};

export default function UserSettings({isOpen, onClose}) {
    const [theme, setTheme] = useState("system");
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const modalRef = useRef(null);
    const initialized = useRef(false);

    const handleClose = useCallback(() => {
        if (isClosing) return;
        setIsClosing(true);
        const timer = setTimeout(() => {
            onClose();
            setIsVisible(false);
            document.body.style.overflow = "unset";
        }, 300);
        return () => clearTimeout(timer);
    }, [isClosing, onClose]);

    // Handle language changes
    const [currentLanguage, setCurrentLanguage] = useState("en");

    // Initialize Google Translate on mount
    useEffect(() => {
        if (typeof window !== "undefined" && !initialized.current) {
            initGoogleTranslate();
            initialized.current = true;

            // Load saved language
            const savedLang = localStorage.getItem("preferredLanguage") || "en";
            if (savedLang) {
                setCurrentLanguage(savedLang);
            }
        }
    }, []);

    const handleLanguageChange = (newLanguage) => {
        if (newLanguage === currentLanguage) return;

        try {
            changeLanguage(newLanguage);
            setCurrentLanguage(newLanguage);
            localStorage.setItem("preferredLanguage", newLanguage);
        } catch (error) {
            alert("Failed to change language. Please try again.");
        }
    };

    // Handle theme changes
    useEffect(() => {
        // Get stored theme or default to 'system'
        const storedTheme = localStorage.getItem("theme") || "system";
        setTheme(storedTheme);

        // Apply the theme
        const applyThemeToDOM = (themeToApply) => {
            

            // Remove all theme-related classes
            document.documentElement.classList.remove(
                "light",
                "dark",
                "light-mode",
                "dark-mode"
            );

            if (themeToApply === "system") {
                // For system theme, let CSS handle it based on prefers-color-scheme
                const isSystemDark = window.matchMedia(
                    "(prefers-color-scheme: dark)"
                ).matches;
                if (isSystemDark) {
                    document.documentElement.classList.add("dark", "dark-mode");
                } else {
                    document.documentElement.classList.add(
                        "light",
                        "light-mode"
                    );
                }
            } else if (themeToApply === "dark") {
                document.documentElement.classList.add("dark", "dark-mode");
            } else {
                document.documentElement.classList.add("light", "light-mode");
            }

            // Force a reflow to ensure styles are applied
            document.documentElement.style.display = "none";
            document.documentElement.offsetHeight; // Trigger reflow
            document.documentElement.style.display = "";
        };

        // Apply initial theme
        applyThemeToDOM(storedTheme);

        // Listen for system theme changes if using system preference
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleSystemThemeChange = () => {
            if (theme === "system") {
                applyThemeToDOM("system");
            }
        };

        mediaQuery.addEventListener("change", handleSystemThemeChange);
        return () =>
            mediaQuery.removeEventListener("change", handleSystemThemeChange);
    }, [theme]);

    const applyTheme = (selectedTheme) => {
        // Save the preference
        localStorage.setItem("theme", selectedTheme);
        setTheme(selectedTheme);

        // Apply the theme
        const isDark =
            selectedTheme === "dark" ||
            (selectedTheme === "system" &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);

        // Remove all theme-related classes and attributes
        document.documentElement.classList.remove(
            "light",
            "dark",
            "light-mode",
            "dark-mode"
        );
        document.documentElement.removeAttribute("data-theme");

        // Add the appropriate class
        if (isDark) {
            document.documentElement.classList.add("dark", "dark-mode");
        } else {
            document.documentElement.classList.add("light", "light-mode");
        }

        // Force a reflow to ensure styles are applied
        document.documentElement.style.display = "none";
        document.documentElement.offsetHeight; // Trigger reflow
        document.documentElement.style.display = "";
    };

    // Handle ESC key press
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e) => {
            if (e.key === "Escape") {
                handleClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, handleClose]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                modalRef.current &&
                !modalRef.current.contains(event.target) &&
                isOpen
            ) {
                handleClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Handle open/close animations
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            // Small delay to allow the initial render before starting the animation
            const timer = setTimeout(() => {
                setIsClosing(false);
            }, 10);
            return () => clearTimeout(timer);
        } else {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                document.body.style.overflow = "unset";
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[99999] overflow-hidden">
            <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
                    isClosing ? "opacity-0" : "opacity-100"
                }`}
                onClick={handleClose}
                role="presentation"
            />
            <div
                ref={modalRef}
                className={`fixed inset-y-0 right-0 w-full max-w-md  user-settings shadow-xl transition-transform duration-300 ease-out transform ${
                    isClosing ? "translate-x-full" : "translate-x-0"
                }`}
                style={{
                    transform: isClosing ? "translateX(100%)" : "translateX(0)",
                    transition: "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <h2 id="modal-title" className="text-lg font-medium ">
                            User Settings
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-red-500 cursor-pointer hover:text-red-300 duration-200 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="space-y-6">
                            {/* Theme Selection */}
                            <div>
                                <h3 className="text-base font-medium  mb-4">
                                    Appearance
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium custom-text-color-lighter">
                                            Theme
                                        </span>
                                        <div
                                            className="inline-flex rounded-md shadow-sm"
                                            role="group"
                                        >
                                            {["light", "system", "dark"].map(
                                                (option) => (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        onClick={() =>
                                                            applyTheme(option)
                                                        }
                                                        className={`px-3 py-1.5 text-sm font-medium cursor-pointer duration-200 transition-colors hover:text-white ${
                                                            theme === option
                                                                ? "bg-blue-600 text-white hover:bg-blue-600"
                                                                : "hover:bg-gray-700"
                                                        } ${
                                                            option ===
                                                                "light" &&
                                                            "rounded-r-none rounded-md"
                                                        } ${
                                                            option === "dark" &&
                                                            "rounded-l-none rounded-md"
                                                        } border border-gray-300 dark:border-gray-600`}
                                                    >
                                                        {option
                                                            .charAt(0)
                                                            .toUpperCase() +
                                                            option.slice(1)}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Language Selection */}
                            <div className="mb-6">
                                <h3 className="text-base font-medium mb-4">
                                    Language
                                </h3>
                                <div className="relative w-full">
                                    <div className="flex items-center space-x-2 w-full">
                                        <Globe className="w-5 h-5 text-gray-500 flex-shrink-0" />
                                        <select
                                            value={currentLanguage}
                                            onChange={(e) =>
                                                handleLanguageChange(
                                                    e.target.value
                                                )
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        >
                                            {Object.entries(LANGUAGES).map(
                                                ([code, name]) => (
                                                    <option
                                                        key={code}
                                                        value={code}
                                                    >
                                                        {name}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>

                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        Select your preferred language
                                    </p>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-base font-medium mb-4">
                                    Account
                                </h3>
                                <p className="text-sm brand-color">
                                    More account settings coming soon...
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
