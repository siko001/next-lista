const transferErrors = {
    lista_guest_required: "WordPress couldn't confirm this guest session.",
    lista_account_token_required: "WordPress didn't receive a valid account session.",
    lista_account_validation_failed: "WordPress couldn't validate the account through its own API.",
    lista_registered_account_required: "WordPress hasn't marked the destination account as registered, or it matches the guest account.",
    lista_acf_required: "The WordPress shopping-list fields are unavailable.",
    lista_transfer_busy: "Another list transfer is running. Wait a moment and try again.",
    lista_guest_already_claimed: "This guest session is already linked to a different account.",
    lista_transfer_failed: "WordPress couldn't save every transferred list. Try logging in again to finish the transfer.",
    rest_no_route: "The WordPress guest-list transfer snippet isn't active yet.",
};

async function transferFailure(response) {
    // Keep diagnostics useful without displaying arbitrary server output or credentials.
    const body = await response.json().catch(() => null);
    const code = typeof body?.code === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(body.code) ? body.code : "transfer_request_failed";
    const reason = transferErrors[code] || (response.status === 404
        ? "The WordPress guest-list transfer endpoint isn't available."
        : "WordPress rejected the guest-list transfer.");
    const error = new Error(`${reason} Your guest session has been kept. (${code}; HTTP ${response.status})`);
    error.code = code;
    error.status = response.status;
    return error;
}

/** Complete the handoff before login replaces the guest cookie. */
export async function claimGuestLists({apiBase, guestToken, guestUserId, accountToken, fetcher = fetch}) {
    if (!guestToken || !guestUserId) return 0;
    const headers = {Authorization: `Bearer ${guestToken}`};
    const response = await fetcher(`${apiBase}/custom/v1/shopping-lists-by-owner/${encodeURIComponent(guestUserId)}`, {headers, cache: "no-store"});
    if (!response.ok) throw new Error("We couldn't check your guest lists. Please try logging in again.");
    const lists = await response.json();
    if (!Array.isArray(lists)) throw new Error("We couldn't check your guest lists. Please try logging in again.");
    const owned = lists.filter(list => String(list?.acf?.owner_id) === String(guestUserId));
    if (!owned.length) return 0;
    const transfer = await fetcher(`${apiBase}/custom/v1/claim-guest-lists`, {
        method: "POST",
        headers: {...headers, "Content-Type": "application/json"},
        body: JSON.stringify({account_token: accountToken}),
    });
    if (!transfer.ok) {
        throw await transferFailure(transfer);
    }
    const result = await transfer.json();
    if (result.success !== true) throw new Error("Your lists haven't finished transferring. Please try logging in again.");
    return result.transferred_count || 0;
}
