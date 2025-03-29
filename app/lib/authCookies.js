'use server';
import { cookies } from 'next/headers';

export async function getAuthCookies() {
    const cookieStore = await cookies();
    return {
        token: cookieStore.get('hodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hg')?.value || null,
        reg: cookieStore.get('hodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hghodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hg')?.value || null,
        userName: cookieStore.get('hodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hghodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hghodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hg')?.value || null
    };
}
