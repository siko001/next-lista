'use server'
import { redirect } from 'next/navigation'
import LogoutClient from './LogoutClient'
import { cookies } from 'next/headers'

export default async function LogoutPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const reg = cookieStore.get('registered')?.value

    if (!token || reg === "no") {
        redirect('/');
    }

    return <LogoutClient />;
}