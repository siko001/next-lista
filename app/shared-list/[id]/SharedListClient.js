'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getSharedList } from '../../lib/api';
import { decryptToken, WP_API_BASE } from '../../lib/helpers';
import { redirect } from 'next/navigation';

export default function SharedListPage({ token, userId, listId }) {
    const router = useRouter();
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const startedRef = useRef(false);

    useEffect(() => {
        // Wait until required data is present, then process exactly once
        if (!listId || !token || !userId) return;
        if (startedRef.current) return;
        startedRef.current = true;

        const processSharedList = async () => {
            try {
                // 1. Get the shared list data
                const data = await getSharedList(listId);
                if (!data.success) {
                    throw new Error(data.message || 'List not found');
                }


                if (listId && userId && token) {
                    // decrypt the token
                    const decryptedToken = decryptToken(token);
                    try {
                        // Register the share with backend
                        const shareList = await fetch(`${WP_API_BASE}/custom/v1/share-list`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${decryptedToken}`
                            },
                            body: JSON.stringify({
                                list_id: listId,
                                user_id: userId,

                            })
                        });
                        const response = await shareList.json();

                    } catch (err) {
                        console.error('Failed to register share:', err);
                    }
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
    }, [listId, token, userId]);

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