// app/utils/translate.js

let googleTranslateElementInit = null;

// Initialize Google Translate
export function initGoogleTranslate() {
    if (typeof window === "undefined") return;

    // Remove any existing Google Translate elements
    const oldWidget = document.querySelector(".goog-te-banner");
    if (oldWidget) {
        oldWidget.remove();
    }

    // Create the Google Translate script if it doesn't exist
    if (!window.google || !window.google.translate) {
        const script = document.createElement("script");
        script.src =
            "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        document.head.appendChild(script);
    }

    // Initialize the widget
    window.googleTranslateElementInit = function () {
        new window.google.translate.TranslateElement(
            {pageLanguage: "en"},
            "google_translate_element"
        );
    };

    // Add styles to hide Google Translate elements
    const style = document.createElement("style");
    style.textContent = `
        /* Hide the Google Translate banner */
        .goog-te-banner-frame.skiptranslate {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            max-height: 0 !important;
            max-width: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
        
        /* Fix body positioning */
        body {
            top: 0 !important;
            position: static !important;
        }
        
        /* Hide the language selector dropdown */
        .goog-te-menu-frame {
            display: none !important;
            visibility: hidden !important;
        }
        
        /* Hide any other Google Translate UI elements */
        .goog-te-gadget, 
        .goog-te-gadget-simple, 
        .goog-te-ftab, 
        .goog-te-menu-value,
        .goog-te-menu-value span,
        .goog-te-menu-value img {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            opacity: 0 !important;
        }
        
        /* Ensure our custom language selector is visible */
        .language-selector {
            display: block !important;
            visibility: visible !important;
        }
    `;
    document.head.appendChild(style);
}

// Change the language
export function changeLanguage(lang) {
    if (
        typeof window === "undefined" ||
        !window.google ||
        !window.google.translate
    ) {
        console.warn("Google Translate not loaded yet");
        return;
    }

    const selectField = document.querySelector(".goog-te-combo");
    if (selectField) {
        selectField.value = lang;
        selectField.dispatchEvent(new Event("change"));
    }
}

// Get current language
export function getCurrentLanguage() {
    if (typeof window === "undefined") return "en";
    const selectField = document.querySelector(".goog-te-combo");
    return selectField ? selectField.value : "en";
}

// Add a hidden element for Google Translate to attach to
if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.id = "google_translate_element";
    div.style.display = "none";
    document.body.appendChild(div);
}
