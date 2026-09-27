import {LogOut, Check} from "lucide-react";

export default function LogoutScreen({leaving = false}) {
    return (
        <main className={`auth-page logout-page ${leaving ? "is-leaving" : ""}`}>
            <nav className="auth-navigation" aria-label="Lista"><span className="auth-logo">LISTA</span></nav>
            <div className="auth-content">
                <section className="auth-card logout-card" aria-labelledby="logout-title">
                    <div className="logout-mark" aria-hidden="true"><LogOut size={28} /></div>
                    <header className="auth-heading">
                        <p className="auth-eyebrow">UNTIL YOUR NEXT SHOP</p>
                        <h1 id="logout-title">See you soon</h1>
                        <p>Your lists are staying safe in your account.<br />Pick up where you left off next time.</p>
                    </header>
                    <div className="logout-status" role="status"><span className="logout-status-dot" aria-hidden="true" />Logging you out…</div>
                    <div className="logout-progress" aria-hidden="true"><span /></div>
                    <p className="logout-note"><Check size={15} aria-hidden="true" />Taking you back to Lista</p>
                </section>
                <p className="auth-footnote">Less remembering. More living.</p>
            </div>
        </main>
    );
}
