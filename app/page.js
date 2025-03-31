'use server'
import { cookies } from 'next/headers'
import HomeClient from './HomeClient'

export default async function Home() {
    const cookieStore = await cookies()
    const reg = cookieStore.get('registered')?.value
    const userName = cookieStore.get('username')?.value

    let isRegistered = false
    if (reg === "yes") {
        isRegistered = true
    }



    return <HomeClient isRegistered={isRegistered} userName={userName} />
}