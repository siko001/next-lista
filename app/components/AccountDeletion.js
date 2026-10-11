"use client";
import {useEffect, useState} from "react";
import {getCookie, deleteCookie} from "cookies-next";
import {decryptToken, WP_API_BASE} from "../lib/helpers";
import {clearAssistantHistory} from "../lib/privacy.mjs";
import {invalidateSessionData, announceLogout} from "../lib/dataCache.mjs";

export default function AccountDeletion() {
    const [available, setAvailable] = useState(false);
    const [preview, setPreview] = useState(null);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [deleted, setDeleted] = useState(false);
    useEffect(() => { setAvailable(Boolean(getCookie("token"))); }, []);
    async function request(path, body) {
        const token = decryptToken(getCookie("token"));
        if (!token) throw new Error("Your session has expired. Use the email request below or sign in again.");
        const response = await fetch(`${WP_API_BASE}/custom/v1/${path}`, {
            method: body ? "POST" : "GET", cache: "no-store", redirect: "error",
            headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
            ...(body ? {body: JSON.stringify(body)} : {}),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not complete deletion. Please try again or contact support.");
        return data;
    }
    async function review() {
        setBusy(true); setMessage("");
        try { setPreview(await request("account-deletion-preview")); }
        catch (error) { setMessage(error.message); }
        finally { setBusy(false); }
    }
    async function remove() {
        if (!confirmed || !preview || busy) return;
        setBusy(true); setMessage("");
        try {
            const result = await request("delete-my-account", {account_id: preview.account_id, confirmation: "DELETE MY LISTA ACCOUNT"});
            if (result.deleted !== true) throw new Error("Deletion was not confirmed. Please contact support.");
            const id = getCookie("id");
            for (const name of ["token", "registered", "id", "username"]) deleteCookie(name);
            invalidateSessionData(id); announceLogout(id);
            window.dispatchEvent(new CustomEvent("lista:logout", {detail: id}));
            try { clearAssistantHistory(localStorage, sessionStorage); } catch { /* Account is already deleted. */ }
            setDeleted(true); setPreview(null); setAvailable(false);
            setMessage("Your Lista account and data have been deleted from the active service. Saved assistant conversations on this device have been cleared. Clear saved conversations on any other devices you used too.");
        } catch (error) { setMessage(error.message); }
        finally { setBusy(false); }
    }
    if (!available && !deleted) return null;
    return <section>
        <h2>Delete the account on this device</h2>
        <p>This also works for guests. Deletion permanently removes your account, owned lists and custom products, and removes you from shared lists.</p>
        {!deleted && !preview && <button type="button" className="public-info-secondary" onClick={review} disabled={busy}>{busy ? "Checking your account…" : "Review account deletion"}</button>}
        {preview && <div className="public-info-delete-confirm">
            <p><strong>{preview.name || "Your account"}</strong>: {preview.owned_lists} owned shopping lists and {preview.custom_products} custom products will be deleted. People you shared those lists with will lose them too.</p>
            <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} /> I understand this is permanent and want to delete my account.</label>
            <div className="public-info-actions">
                <button type="button" className="public-info-secondary" onClick={remove} disabled={!confirmed || busy}>{busy ? "Deleting…" : "Permanently delete my account"}</button>
                <button type="button" className="public-info-secondary" onClick={() => { setPreview(null); setConfirmed(false); }} disabled={busy}>Cancel</button>
            </div>
        </div>}
        {message && <p role="status" className="public-info-notice">{message}</p>}
    </section>;
}
