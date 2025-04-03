import ShoppingList from "./ShoppingList";
import { getListDetails, getAllProducts } from "../../lib/helpers";
import { cookies } from 'next/headers'

export default async function Page() {

    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const reg = cookieStore.get('registered')?.value
    const userName = cookieStore.get('username')?.value
    const id = cookieStore.get('id')?.value
    const listId = cookieStore.get('listId')?.value

    let isRegistered = false
    if (reg === "yes") {
        isRegistered = true
    }

    const list = await getListDetails(listId, token)
    // const products = await getAllProducts(token)

    return (
        <ShoppingList isRegistered={isRegistered} userName={userName} list={list} products={[]} />
    )
}