/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-saira)", "Arial", "sans-serif"],
                quicksand: ["var(--font-quicksand)", "sans-serif"],
                saira: ["var(--font-saira)", "sans-serif"],
            },
            colors: {
                light: {
                    DEFAULT: "#ffffff",
                    foreground: "#111827",
                },
                dark: {
                    DEFAULT: "#111827",
                    foreground: "#f9fafb",
                },
                primary: {
                    DEFAULT: "#21ba9c",
                    50: "#f0fdfa",
                    100: "#ccfbf1",
                    200: "#99f6e4",
                    300: "#5eead4",
                    400: "#2dd4bf",
                    500: "#14b8a6",
                    600: "#0d9488",
                    700: "#0f766e",
                    800: "#115e59",
                    900: "#134e4a",
                    950: "#042f2e",
                },
            },
        },
    },
    plugins: [
        function ({addVariant, e}) {
            // Add a custom variant for dark mode that we can force
            addVariant("dark-mode", ".dark-mode &");

            // Add a custom variant for light mode
            addVariant("light-mode", ".light-mode &");
        },
    ],
};
