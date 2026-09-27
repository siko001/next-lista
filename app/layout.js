import {Geist, Geist_Mono} from "next/font/google";
import {UserProvider} from "./contexts/UserContext";
import {OverlayProvider} from "./contexts/OverlayContext";
import {NotificationProvider} from "./contexts/NotificationContext";
import {ValidationProvider} from "./contexts/ValidationContext";
import {ListProvider} from "./contexts/ListContext";
import {LoadingProvider} from "./contexts/LoadingContext";
import {ProductProvider} from "./contexts/ProductContext";
import "./globals.css";
import "./css/list-pages.css";
import "./css/page-skeleton.css";
import "./css/auth.css";
import "./css/settings.css";
import "./css/not-found.css";
import {Quicksand, Saira} from "next/font/google";
import {cookies} from "next/headers";
import AnimatedFavicon from "./components/AnimatedFavicon";
import SiteCredit from "./components/SiteCredit";
import AssistantAddProgress from "./components/AssistantAddProgress";

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
};

// This script runs before the page renders to prevent flash of incorrect theme
const ThemeScript = () => {
    const themeScript = `
        (function() {
            var html = document.documentElement;
            html.classList.add('theme-loading');
            var preference = 'system';
            try { preference = localStorage.getItem('theme') || 'system'; } catch (_) {}
            var dark = preference === 'dark' ||
                (preference !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            var theme = dark ? 'dark' : 'light';
            html.classList.remove('dark', 'dark-mode', 'light', 'light-mode');
            html.classList.add(theme, theme + '-mode');
            html.style.colorScheme = theme;
            var favicon = document.getElementById('lista-favicon');
            if (!favicon) {
                favicon = document.createElement('link');
                favicon.id = 'lista-favicon';
                favicon.rel = 'icon';
                favicon.type = 'image/svg+xml';
                document.head.appendChild(favicon);
            }
            favicon.href = dark ? '/favicon-dark.svg' : '/favicon-light.svg';
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    html.classList.remove('theme-loading');
                    html.classList.add('theme-loaded');
                });
            });
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

export default async function RootLayout({children}) {
    const cookieStore = await cookies();
    const initialRegistered = cookieStore.get("registered")?.value === "yes";
    const initialUserName = cookieStore.get("username")?.value;
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <noscript><link rel="icon" type="image/svg+xml" href="/favicon-light.svg" /></noscript>
                <ThemeScript />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} ${saira.variable} ${quicksand.variable} font-saira antialiased transition-colors duration-200`}
            >
                <AnimatedFavicon />
                <LoadingProvider>
                    <NotificationProvider>
                        <ListProvider>
                            <UserProvider initialRegistered={initialRegistered} initialUserName={initialUserName}>
                                <AssistantAddProgress />
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

                <footer className="site-footer">
                    <SiteCredit />
                </footer>
            </body>
        </html>
    );
}
