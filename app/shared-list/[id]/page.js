import { cookies } from 'next/headers';
import SharedListClient from './SharedListClient';

export default async function SharedListPage({ params }) {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const userId = cookieStore.get('id')?.value;
    const { id: listId } = await params;

    return (
        <SharedListClient
            listId={listId}
            token={token}
            userId={userId}
        />
    );
}