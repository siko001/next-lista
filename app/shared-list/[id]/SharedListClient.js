'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSharedList } from '../../lib/api';
import { decryptToken } from '../../lib/helpers';
import { redirect } from 'next/navigation';

export default function SharedListPage({ token, userId, listId }) {
    const router = useRouter();
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token || !userId) {
            redirect(`/shared-list/${listId}`);
        }
    }, []);

    useEffect(() => {
        if (!listId) return;

        const processSharedList = async () => {
            try {
                // 1. Get the shared list data
                const data = await getSharedList(listId);
                if (!data.success) {
                    throw new Error(data.message || 'List not found');
                }

                const WP_API_BASE = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';

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
                router.push('/');

            } catch (err) {
                setError(err.message || 'Failed to process shared list');
            } finally {
                setLoading(false);
            }
        };

        processSharedList();
    }, []);

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