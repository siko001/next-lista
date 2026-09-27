import Link from "next/link";
import {ArrowRight, Check, CircleAlert, ShoppingBag, UsersRound} from "lucide-react";
import "../../css/shared-list.css";

export default function SharedListStatus({phase = "loading", error}) {
    const isLoading = phase === "loading";
    const isSuccess = phase === "success";

    return (
        <main className="auth-page shared-join-page">
            <nav className="auth-navigation" aria-label="Main navigation">
                <Link href="/" className="auth-logo">LISTA</Link>
                <span className="shared-join-nav-label"><UsersRound size={17} aria-hidden="true" /> Shared lists</span>
            </nav>

            <div className="auth-content shared-join-content">
                <section className="auth-card shared-join-card" aria-labelledby="shared-join-title" aria-busy={isLoading || undefined}>
                    <div className={`shared-join-mark ${isSuccess ? "is-complete" : ""} ${phase === "error" ? "has-error" : ""}`} aria-hidden="true">
                        <ShoppingBag size={34} strokeWidth={1.9} />
                        <span>{phase === "error" ? <CircleAlert size={19} /> : isSuccess ? <Check size={20} strokeWidth={3} /> : <UsersRound size={20} />}</span>
                    </div>
                    <p className="shared-join-eyebrow">BETTER TOGETHER</p>
                    <h1 id="shared-join-title">{isSuccess ? "You're on the list!" : phase === "error" ? "Couldn't join this list" : "Joining your shared list"}</h1>
                    <p className="shared-join-description">
                        {isSuccess
                            ? "This list is now part of your space. Everyone sharing it can keep shopping in sync."
                            : phase === "error"
                                ? "This invite may have expired, or something interrupted the connection."
                                : "We're adding the list to your space so you can shop together."}
                    </p>

                    {isLoading && (
                        <div className="shared-join-progress" role="status" aria-label="Adding shared list">
                            <div className="shared-join-progress-label"><span className="shared-join-status-dot" aria-hidden="true" />Connecting your lists…</div>
                            <div className="shared-join-progress-track" aria-hidden="true"><span /></div>
                        </div>
                    )}
                    {isSuccess && <div className="shared-join-result" role="status"><Check size={18} aria-hidden="true" />Taking you to your lists…</div>}
                    {phase === "error" && (
                        <>
                            {error && <p className="shared-join-error" role="alert">{error}</p>}
                            <div className="shared-join-actions">
                                <Link href="/" className="app-primary-action">Back to your lists <ArrowRight size={18} aria-hidden="true" /></Link>
                            </div>
                        </>
                    )}
                </section>
                <p className="auth-footnote">Better lists happen together.</p>
            </div>
        </main>
    );
}
