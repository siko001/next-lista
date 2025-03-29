'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LoginClient from './LoginClient'

export default async function RegisterPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('hodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hg')?.value
    const reg = cookieStore.get('hodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hghodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hg')?.value

    if (token && reg === "yes") {
        redirect('/')
    }


    return <LoginClient />
}