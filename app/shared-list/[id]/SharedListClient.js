"use client";
import {useRouter, useSearchParams} from "next/navigation";
import {useEffect, useMemo, useRef, useState} from "react";
import {getSharedList} from "../../lib/api";
import {decryptToken, WP_API_BASE} from "../../lib/helpers";
import {invalidateCurrentLists} from "../../lib/dataCache.mjs";
import {useUserContext} from "../../contexts/UserContext";
import SharedListStatus from "./SharedListStatus";

export default function SharedListPage({token, userId, listId}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState(null);
    const [phase, setPhase] = useState("loading");
    const {userData, token: ctxToken} = useUserContext();

    const startedRef = useRef(false);
    const redirectRef = useRef(null);

    useEffect(() => () => clearTimeout(redirectRef.current), []);

    const effectiveToken = useMemo(() => token || ctxToken, [token, ctxToken]);
    const effectiveUserId = useMemo(
        () => userId || userData?.id,
        [userId, userData?.id]
    );

    // One-time safety refresh if cookies become available late and context is also missing
    useEffect(() => {
        if (token && userId) return; // SSR cookies present
        if (effectiveToken && effectiveUserId) return; // context resolved
        const t = setTimeout(() => {
            if (!sessionStorage.getItem("shared_list_auto_refresh")) {
                sessionStorage.setItem("shared_list_auto_refresh", "1");
                window.location.reload();
            } else {
                setError("Sign in, then open this share link again to join the list.");
                setPhase("error");
            }
        }, 5000);
        return () => clearTimeout(t);
    }, [effectiveToken, effectiveUserId, token, userId]);

    useEffect(() => {
        // Require invite code `k` in the URL
        const code = searchParams?.get("k");
        if (!code) {
            setError("This share link is invalid or missing a code.");
            setPhase("error");
            return;
        }

        // Wait until required data is present, then process exactly once
        if (!listId || !effectiveToken || !effectiveUserId) return;
        if (startedRef.current) return;
        startedRef.current = true;

        const processSharedList = async () => {
            try {
                // Optional: lightweight validation (can be removed)
                const data = await getSharedList(listId);
                if (!data.success) {
                    throw new Error(data.message || "List not found");
                }

                // Accept the share by validating the invite code server-side
                const decryptedToken = decryptToken(effectiveToken);
                try {
                    const res = await fetch(
                        `${WP_API_BASE}/custom/v1/accept-shared-list`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${decryptedToken}`,
                            },
                            body: JSON.stringify({
                                list_id: listId,
                                user_id: effectiveUserId,
                                code,
                            }),
                        }
                    );
                    const response = await res.json();
                    if (!res.ok || !response?.success) {
                        throw new Error(
                            response?.message || "Invalid or expired share link"
                        );
                    }
                    invalidateCurrentLists();
                } catch (err) {
                    console.error("Failed to accept share:", err);
                    throw err;
                }
                setPhase("success");
                redirectRef.current = setTimeout(() => router.replace("/"), 950);
            } catch (err) {
                setError(err.message || "Failed to process shared list");
                setPhase("error");
            }
        };

        processSharedList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listId, effectiveToken, effectiveUserId]);

    return <SharedListStatus phase={phase} error={error} />;
}
