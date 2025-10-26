import {Geist, Geist_Mono} from "next/font/google";
import {UserProvider} from "./contexts/UserContext";
import {OverlayProvider} from "./contexts/OverlayContext";
import {NotificationProvider} from "./contexts/NotificationContext";
import {ValidationProvider} from "./contexts/ValidationContext";
import {ListProvider} from "./contexts/ListContext";
import {LoadingProvider} from "./contexts/LoadingContext";
import {ProductProvider} from "./contexts/ProductContext";
import "./globals.css";
import {Quicksand, Saira} from "next/font/google";

const quicksand = Quicksand({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"],
    display: "swap",
    variable: "--font-quicksand",
});

const saira = Saira({
    subsets: ["latin"],
    weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
    style: ["normal", "italic"],
    display: "swap",
    variable: "--font-saira",
});

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata = {
    title: "Lista - Your Only Shopping List",
    description:
        "Share your shopping list with your family and friends and they will receive real-time updates.",
    icons: {
        icon: "/favicon.png",
    },
};

// This script runs before the page renders to prevent flash of incorrect theme
const ThemeScript = () => {
    const themeScript = `
        (function() {
            try {
                // Function to get a cookie by name
                function getCookie(name) {
                    const value = '; ' + document.cookie;
                    const parts = value.split('; ' + name + '=');
                    if (parts.length === 2) return parts.pop().split(';').shift();
                    return null;
                }
                
                // Check if user is authenticated (has a token cookie)
                const isAuthenticated = !!getCookie('token');
                
                // Only apply theme if user is authenticated
                if (isAuthenticated) {
                    // Get stored theme or default to 'system'
                    const storedTheme = localStorage.getItem('theme') || 'system';
                    
                    // Check if the user has a saved theme preference
                    if (storedTheme === 'dark' || storedTheme === 'light') {
                        // If user has explicitly chosen a theme, apply it immediately
                        document.documentElement.classList.add(storedTheme, storedTheme + '-mode');
                    } else {
                        // For system theme, check the preferred color scheme
                        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        if (isDark) {
                            document.documentElement.classList.add('dark', 'dark-mode');
                        } else {
                            document.documentElement.classList.add('light', 'light-mode');
                        }
                    }
                } else {
                    // If not authenticated, ensure no theme classes are present
                    const html = document.documentElement;
                    ['dark', 'dark-mode', 'light', 'light-mode'].forEach(cls => html.classList.remove(cls));
                    html.removeAttribute('data-theme');
                }
                
                // Add a class to prevent transitions during initial load
                document.documentElement.classList.add('theme-loading');
                
                // Remove the loading class after a short delay to prevent flash
                setTimeout(() => {
                    document.documentElement.classList.remove('theme-loading');
                    document.documentElement.classList.add('theme-loaded');
                }, 0);
            } catch (e) {
                console.error('Error applying theme:', e);
            }
        })();
    `;

    return (
        <script
            dangerouslySetInnerHTML={{__html: themeScript}}
            // This ensures the script runs before anything else
            suppressHydrationWarning
        />
    );
};

export default function RootLayout({children}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <ThemeScript />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} ${saira} ${quicksand} antialiased bg-white dark:bg-black text-gray-900 dark:text-gray-100 transition-colors duration-200`}
            >
                <LoadingProvider>
                    <NotificationProvider>
                        <ListProvider>
                            <UserProvider>
                                <ProductProvider>
                                    <ValidationProvider>
                                        <OverlayProvider>
                                            {children}
                                        </OverlayProvider>
                                    </ValidationProvider>
                                </ProductProvider>
                            </UserProvider>
                        </ListProvider>
                    </NotificationProvider>
                </LoadingProvider>

                <a
                    href="https://neilmallia.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fixed bottom-2 left-2 z-50 brand-color transition-colors duration-200 text-[10px] !border-0 "
                >
                    By Neil VM
                </a>
            </body>
        </html>
    );
}
