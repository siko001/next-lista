"use client";

import {useState} from "react";
import AccountDeletion from "./AccountDeletion";
import Link from "next/link";
import {ArrowLeft, Mail, ShieldCheck, Trash2} from "lucide-react";
import {copyText} from "../lib/platform.mjs";
import {DEVELOPER_NAME, SUPPORT_EMAIL, POLICY_UPDATED, DELETION_DAYS, deletionEmailUrl, clearAssistantHistory} from "../lib/privacy.mjs";

export default function PublicInfo({deletion = false}) {
    const [notice, setNotice] = useState("");
    const copyEmail = async () => {
        try { await copyText(SUPPORT_EMAIL); setNotice("Email address copied."); }
        catch { setNotice(`You can write to ${SUPPORT_EMAIL} using any email service.`); }
    };
    const clearHistory = () => {
        try {
            clearAssistantHistory(localStorage, sessionStorage);
            setNotice("Saved assistant conversations and voice drafts were cleared on this device. Your account and shopping lists are unchanged.");
        } catch { setNotice("Could not clear saved conversations. You can clear Lista’s storage in your device or browser settings."); }
    };
    return <main className="public-info-page">
        <nav className="public-info-nav" aria-label="Main navigation">
            <Link href="/" className="public-info-logo">LISTA</Link>
            <Link href="/"><ArrowLeft size={16} aria-hidden="true" />Back to Lista</Link>
        </nav>
        <article className="public-info-card">
            <span className="public-info-emblem" aria-hidden="true">{deletion ? <Trash2 /> : <ShieldCheck />}</span>
            <p className="public-info-eyebrow">YOUR DATA, YOUR CHOICE</p>
            <h1>{deletion ? "Delete your Lista account" : "Lista privacy policy"}</h1>
            {deletion ? <>
                <p>You can request deletion here even if you have uninstalled Lista. You do not need to sign in or reinstall the app.</p>
                <AccountDeletion />
                <section>
                    <h2>Send a deletion request</h2>
                    <p>Email <a href={deletionEmailUrl}>{SUPPORT_EMAIL}</a> with the subject <strong>Lista account and data deletion request</strong>. Send it from the email address linked to your account when possible. If you no longer have access to it, tell us so we can discuss another way to verify ownership.</p>
                    <p>We will verify that the account is yours before deleting it. Do not send your password. We aim to complete verified requests within {DELETION_DAYS} days of receiving your request and will contact you if we need more information.</p>
                    <div className="public-info-actions">
                        <a className="app-primary-action" href={deletionEmailUrl}><Mail size={17} aria-hidden="true" />Email deletion request</a>
                        <button type="button" className="public-info-secondary" onClick={copyEmail}>Copy email address</button>
                    </div>
                    <p className="public-info-note">The button opens your email app. Your request is sent only when you send the email. If no email app opens, copy the address and use your usual email service.</p>
                </section>
                <section>
                    <h2>What will be deleted</h2>
                    <p>Your Lista account and profile, favourites, custom products, and shopping lists you own will be removed. Lists you own will also disappear for people you shared them with. Your membership of other people’s lists will be removed; their lists remain.</p>
                    <p>Deletion is permanent. People may still have copies they previously exported or saved outside Lista. Uninstalling the app alone does not delete your server account.</p>
                </section>
                <section>
                    <h2>Data on this device</h2>
                    <p>Assistant conversations and voice drafts are saved on the device where you use Lista. Clear them here on each device you use, or clear the app’s storage. This does not send an account-deletion request.</p>
                    <button type="button" className="public-info-secondary" onClick={clearHistory}>Clear saved assistant conversations</button>
                </section>
                <section>
                    <h2>Retention and questions</h2>
                    <p>Account data is removed from the active service when your request is completed. Infrastructure backups and security logs may remain until they expire under the service providers’ retention schedules. If specific records must be kept for legal or security reasons, we will explain the reason and retention period when responding to your request.</p>
                    <p>You can also email us to request deletion of particular data while keeping your account, or ask about guest data. See the <Link href="/privacy">privacy policy</Link> for details about how Lista uses data.</p>
                </section>
            </> : <>
                <p className="public-info-note">Last updated: {POLICY_UPDATED}</p>
                <p>Lista is provided by {DEVELOPER_NAME}. This policy covers the Lista shopping list app and website. For support, privacy questions, or requests about your data, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
                <section>
                    <h2>Information Lista uses</h2>
                    <ul>
                        <li><strong>Accounts:</strong> email address, display name, account identifier, and authentication information are used to register, sign in, and recover your account. Guest use also creates an account identifier.</li>
                        <li><strong>Shopping:</strong> list names, items, favourites, custom products, and list memberships are stored to provide and synchronise your lists.</li>
                        <li><strong>Optional AI features:</strong> your messages and recent conversation context are sent to an AI provider to generate replies. When you record voice input, the recording is uploaded for transcription and item extraction. Transcripts and assistant conversations can be saved locally on your device.</li>
                        <li><strong>Device preferences and technical data:</strong> theme, language, session information, and cached data are stored on your device. Hosting and service providers also process connection information such as IP addresses and operational logs when you connect.</li>
                    </ul>
                </section>
                <section>
                    <h2>Services and sharing</h2>
                    <p>Lista uses WordPress hosted by Hostinger for accounts and shopping data, Vercel for the website and AI request handling. Shared-list updates are checked directly with WordPress using your authenticated session. AI chat uses OpenAI or Groq depending on the server configuration; voice transcription uses Groq. Google Translate is used for the language feature and can process displayed page text. These services process data to deliver their respective features and may process it outside your country.</p>
                    <p>When you share a list, its contents and relevant account display names are available to its members. Treat invitation links as access links and share them only with intended recipients. External links open third-party services with their own privacy practices.</p>
                    <p>Lista does not include advertising or sell your personal information.</p>
                </section>
                <section>
                    <h2>Microphone and AI choices</h2>
                    <p>Voice input is optional. Lista requests microphone permission when you start recording; you can deny or revoke it in your device settings and continue using typed lists. Recordings are sent to Groq to transcribe your speech. Avoid including sensitive information in voice recordings or AI messages.</p>
                    <p>Lista’s voice endpoint processes recordings for the request and does not deliberately save audio files to its database. AI providers may retain request data under their own terms and account settings. AI replies can be inaccurate; review suggested items before adding them.</p>
                </section>
                <section>
                    <h2>Storage and retention</h2>
                    <p>Account and shopping data are kept while your account is in use and until deletion is completed. Assistant conversations and voice drafts remain on your device until cleared. Mobile authentication is stored using the device’s secure storage; the website uses browser cookies for its session.</p>
                    <p>After a deletion request is fulfilled, infrastructure backups and security logs may persist under the providers’ retention schedules. Any specific legal or security retention will be explained in the response to your request. Contact us for details about retention or a copy of your account data.</p>
                </section>
                <section>
                    <h2>Your choices and deletion</h2>
                    <p>You can edit or remove your lists, revoke microphone permission, clear locally saved conversations, and request access, correction, or deletion by emailing us. For account deletion, follow the <Link href="/delete-account">Lista account deletion instructions</Link>. We aim to complete verified requests within {DELETION_DAYS} days of receiving them.</p>
                    <p>If this policy changes, the updated policy and date will appear on this page.</p>
                </section>
            </>}
            {notice && <p className="public-info-notice" role="status">{notice}</p>}
            <footer className="public-info-footer"><Link href="/privacy">Privacy policy</Link><Link href="/delete-account">Delete account</Link><a href={`mailto:${SUPPORT_EMAIL}`}>Contact support</a></footer>
        </article>
    </main>;
}
