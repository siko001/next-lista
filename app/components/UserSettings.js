"use client";

import {useState, useEffect, useRef, useCallback} from "react";
import dynamic from "next/dynamic";

// Dynamically import the X icon with no SSR
const X = dynamic(() => import("lucide-react").then((mod) => mod.X), {
    ssr: false,
});

export default function UserSettings({isOpen, onClose}) {
    const [theme, setTheme] = useState("system");
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const modalRef = useRef(null);

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

    // Handle theme changes
    useEffect(() => {
        // Get stored theme or default to 'system'
        const storedTheme = localStorage.getItem('theme') || 'system';
        setTheme(storedTheme);
        
        // Apply the theme
        const applyThemeToDOM = (themeToApply) => {
            console.log('Applying theme:', themeToApply);
            
            // Remove all theme-related classes
            document.documentElement.classList.remove('light', 'dark', 'light-mode', 'dark-mode');
            
            if (themeToApply === 'system') {
                // For system theme, let CSS handle it based on prefers-color-scheme
                const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (isSystemDark) {
                    document.documentElement.classList.add('dark', 'dark-mode');
                } else {
                    document.documentElement.classList.add('light', 'light-mode');
                }
            } else if (themeToApply === 'dark') {
                document.documentElement.classList.add('dark', 'dark-mode');
            } else {
                document.documentElement.classList.add('light', 'light-mode');
            }
            
            // Force a reflow to ensure styles are applied
            document.documentElement.style.display = 'none';
            document.documentElement.offsetHeight; // Trigger reflow
            document.documentElement.style.display = '';
        };
        
        // Apply initial theme
        applyThemeToDOM(storedTheme);
        
        // Listen for system theme changes if using system preference
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = () => {
            console.log('System theme changed');
            if (theme === 'system') {
                applyThemeToDOM('system');
            }
        };
        
        mediaQuery.addEventListener('change', handleSystemThemeChange);
        return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }, [theme]);
    
    const applyTheme = (selectedTheme) => {
        // Save the preference
        localStorage.setItem('theme', selectedTheme);
        setTheme(selectedTheme);
        
        // Apply the theme
        const isDark = selectedTheme === 'dark' || 
                      (selectedTheme === 'system' && 
                       window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        // Remove all theme-related classes and attributes
        document.documentElement.classList.remove('light', 'dark', 'light-mode', 'dark-mode');
        document.documentElement.removeAttribute('data-theme');
        
        // Add the appropriate class
        if (isDark) {
            document.documentElement.classList.add('dark', 'dark-mode');
        } else {
            document.documentElement.classList.add('light', 'light-mode');
        }
        
        // Force a reflow to ensure styles are applied
        document.documentElement.style.display = 'none';
        document.documentElement.offsetHeight; // Trigger reflow
        document.documentElement.style.display = '';
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
                className={`fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-xl transition-transform duration-300 ease-out transform ${
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
                        <h2
                            id="modal-title"
                            className="text-lg font-medium text-gray-900 dark:text-white"
                        >
                            User Settings
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="space-y-6">
                            {/* Theme Selection */}
                            <div>
                                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-4">
                                    Appearance
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                                                        className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                                                            theme === option
                                                                ? "bg-blue-600 text-white"
                                                                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                                        } ${
                                                            option === "light"
                                                                ? "rounded-r-none"
                                                                : ""
                                                        } ${
                                                            option === "dark"
                                                                ? "rounded-l-none"
                                                                : ""
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

                            {/* Add more settings sections here */}
                            <div>
                                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-4">
                                    Account
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
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
