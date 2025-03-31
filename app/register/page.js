'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import RegisterClient from './RegisterClient'

export default async function RegisterPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const reg = cookieStore.get('registered')?.value

    if (token && reg === "yes") {
        redirect('/')
    }


    return <RegisterClient />
}