'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSharedList } from '../../lib/api';
import { decryptToken, WP_API_BASE } from '../../lib/helpers';
import { useUserContext } from '../../contexts/UserContext';

export default function SharedListPage({ token, userId, listId }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const { userData, token: ctxToken, loading: ctxLoading } = useUserContext();

    const startedRef = useRef(false);

    const effectiveToken = useMemo(() => token || ctxToken, [token, ctxToken]);
    const effectiveUserId = useMemo(() => userId || userData?.id, [userId, userData?.id]);

    // One-time safety refresh if cookies become available late and context is also missing
    useEffect(() => {
        if (token && userId) return; // SSR cookies present
        if (effectiveToken && effectiveUserId) return; // context resolved
        const already = sessionStorage.getItem('shared_list_auto_refresh');
        const t = setTimeout(() => {
            if (!sessionStorage.getItem('shared_list_auto_refresh')) {
                sessionStorage.setItem('shared_list_auto_refresh', '1');
                window.location.reload();
            }
        }, 5000);
        return () => clearTimeout(t);
    }, [effectiveToken, effectiveUserId, token, userId]);

    useEffect(() => {
        // Require invite code `k` in the URL
        const code = searchParams?.get('k');
        if (!code) {
            setError('This share link is invalid or missing a code.');
            setLoading(false);
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
                    throw new Error(data.message || 'List not found');
                }


                // Accept the share by validating the invite code server-side
                const decryptedToken = decryptToken(effectiveToken);
                try {
                    const res = await fetch(`${WP_API_BASE}/custom/v1/accept-shared-list`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${decryptedToken}`
                        },
                        body: JSON.stringify({
                            list_id: listId,
                            user_id: effectiveUserId,
                            code,
                        })
                    });
                    const response = await res.json();
                    if (!res.ok || !response?.success) {
                        throw new Error(response?.message || 'Invalid or expired share link');
                    }
                } catch (err) {
                    console.error('Failed to accept share:', err);
                    throw err;
                }
                // 4. Redirect to the main lists page
                router.replace('/');

            } catch (err) {
                setError(err.message || 'Failed to process shared list');
            } finally {
                setLoading(false);
            }
        };

        processSharedList();
    }, [listId, effectiveToken, effectiveUserId]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p>Adding shared list to your account...</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center h-screen">
            <div className="text-red-500 text-xl mb-4">Error</div>
            <p className="text-center max-w-md">{error}</p>
            <button
                onClick={() => router.push('/')}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Back to My Lists
            </button>
        </div>
    );

    return null; // This component doesn't render any content
}