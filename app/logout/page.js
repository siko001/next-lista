'use server'
import { redirect } from 'next/navigation'
import LogoutClient from './LogoutClient'
import { getAuthCookies } from '../lib/AuthCookies'

export default async function LogoutPage() {
    const { token, reg } = await getAuthCookies();

    if (!token || reg === "no") {
        redirect('/');
    }

    return <LogoutClient />;
}