"use client";

import Link from "next/link";
import {useState} from "react";
import {ShoppingBag, Sparkles, ArrowRight, Mail, KeyRound, ChevronDown} from "lucide-react";
import UserSettings from "../UserSettings";
import SiteCredit from "../SiteCredit";

const screens = {
    login: {id: "login-form", eyebrow: "GOOD TO SEE YOU AGAIN", title: "Welcome back", description: "Your lists are waiting. Let’s pick up where you left off.", prompt: "New around here?", href: "/register", link: "Create an account", icon: ShoppingBag},
    register: {id: "register-form", eyebrow: "A LITTLE MORE ORGANISED", title: "Create your account", description: "Your lists, your people, your next great shop.", prompt: "Already part of the list?", href: "/login", link: "Log in", icon: ShoppingBag},
    forgot: {id: "password-reset-form", eyebrow: "LET’S GET YOU BACK IN", title: "Forgot your password?", description: "It happens. Enter your email and we’ll send you a reset link.", prompt: "Remembered it?", href: "/login", link: "Back to login", icon: Mail},
    reset: {id: "reset-password-form", eyebrow: "A FRESH START", title: "Choose a new password", description: "Make it one that’s just for you. Your lists will be right where you left them.", prompt: "Ready to return?", href: "/login", link: "Back to login", icon: KeyRound},
};

export default function AuthShell({register = false, mode, loading = false, children}) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const screen = screens[mode || (register ? "register" : "login")];
    const Icon = screen.icon;
    const recovery = mode === "forgot" || mode === "reset";
    return (
        <main id={screen.id} className="auth-page">
            <nav className="auth-navigation" aria-label="Main navigation">
                <Link href="/" className="auth-logo">LISTA</Link>
                <div className="app-account-actions">
                    <button type="button" onClick={() => setIsSettingsOpen(true)} className="app-account-button is-guest" aria-label="Open account settings" aria-haspopup="dialog" aria-expanded={isSettingsOpen}>
                        <span className="app-account-avatar" aria-hidden="true">👋</span>
                        <span className="app-account-name">Guest</span>
                        <ChevronDown size={15} aria-hidden="true" />
                    </button>
                    <Link href={recovery ? "/login" : "/"} className="app-primary-action">{recovery ? "Back to login" : "Home"}</Link>
                </div>
            </nav>
            <UserSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            <div className="auth-content">
                <section className="auth-card" aria-labelledby="auth-title" aria-busy={loading || undefined}>
                    <div className="auth-mark" aria-hidden="true"><Icon /><Sparkles className="auth-sparkle" /></div>
                    <header className="auth-heading">
                        <p className="auth-eyebrow">{screen.eyebrow}</p>
                        <h1 id="auth-title">{screen.title}</h1>
                        <p>{screen.description}</p>
                    </header>
                    {children}
                    <footer className="auth-switch">
                        <span>{screen.prompt}</span>
                        <Link href={screen.href}>{screen.link}<ArrowRight size={16} aria-hidden="true" /></Link>
                    </footer>
                </section>
                <p className="auth-footnote">Less remembering. More living.</p>
                <footer className="auth-credit"><SiteCredit /></footer>
            </div>
        </main>
    );
}
