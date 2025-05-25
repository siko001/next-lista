"use server";
import {cookies} from "next/headers";
import {getShoppingList} from "./lib/helpers";
import HomeClient from "./HomeClient";

export default async function Home() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const reg = cookieStore.get("registered")?.value;
    const userName = cookieStore.get("username")?.value;
    const id = cookieStore.get("id")?.value;

    let isRegistered = false;
    if (reg === "yes") {
        isRegistered = true;
    }

    const lists = await getShoppingList(id, token);
    return (
        <HomeClient
            isRegistered={isRegistered}
            userName={userName}
            lists={lists}
            serverToken={token}
            userId={id}
        />
    );
}
