'use server'
import { cookies } from 'next/headers'
import HomeClient from './HomeClient'

export default async function Home() {
    const cookieStore = await cookies()
    const reg = cookieStore.get('hodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hghodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hg')?.value
    const userName = cookieStore.get('hodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hghodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hghodowipefhwfg8wgfd687gbbru3fg3bfgh3297fgh2e7g3hg')?.value

    let isRegistered = false
    if (reg === "yes") {
        isRegistered = true
    }

    return <HomeClient isRegistered={isRegistered} userName={userName} />
}