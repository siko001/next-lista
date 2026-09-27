import Link from "next/link";
import {ArrowLeft, ArrowRight, Check, ShoppingBag, Sparkles} from "lucide-react";
import BackButton from "./components/BackButton";

export const metadata = {title: "Page not found | Lista"};

export default function NotFound() {
    return (
        <main className="missing-page">
            <nav className="missing-nav" aria-label="Main navigation">
                <Link href="/" className="missing-logo">LISTA</Link>
                <Link href="/" className="missing-nav-link"><ArrowLeft size={17} aria-hidden="true" /> Home</Link>
            </nav>

            <section className="missing-content" aria-labelledby="missing-title">
                <div className="missing-illustration" aria-hidden="true">
                    <span className="missing-orbit missing-orbit-one" />
                    <span className="missing-orbit missing-orbit-two" />
                    <span className="missing-sparkle missing-sparkle-one"><Sparkles size={23} /></span>
                    <span className="missing-sparkle missing-sparkle-two"><Sparkles size={16} /></span>
                    <div className="missing-bag"><ShoppingBag size={70} strokeWidth={1.8} /><Check className="missing-check" size={28} strokeWidth={3} /></div>
                    <span className="missing-number">4<span>0</span>4</span>
                </div>
                <p className="missing-eyebrow">LOST SOMETHING?</p>
                <h1 id="missing-title">This page slipped off the list.</h1>
                <p className="missing-description">The link may have moved, or this page was never here. Let’s get you back to the good stuff.</p>
                <div className="missing-actions">
                    <Link href="/" className="missing-primary">Back to your lists <ArrowRight size={19} aria-hidden="true" /></Link>
                    <BackButton />
                </div>
            </section>
            <p className="missing-footer">No worries. Every great shop takes a little detour.</p>
        </main>
    );
}
