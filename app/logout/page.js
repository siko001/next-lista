'use server'
import { redirect } from 'next/navigation'
import LogoutClient from './LogoutClient'
import { cookies } from 'next/headers'

export default async function LogoutPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('hodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hg')?.value
    const reg = cookieStore.get('hodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hghodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hg')?.value

    if (!token || reg === "no") {
        redirect('/');
    }

    return <LogoutClient />;
}