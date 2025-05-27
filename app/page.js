"use server";
import {cookies} from "next/headers";
import {getShoppingList} from "./lib/helpers";
import HomeClient from "./HomeClient";
import {getListMetadata} from "./actions/listActions";

async function prepareMetadata(lists, userId) {
    if (!lists || !userId || !Array.isArray(lists)) return {};

    try {
        const metadata = {};
        for (const list of lists) {
            if (list && list.id) {
                const listMeta = await getListMetadata(list, userId);
                if (listMeta) {
                    metadata[list.id] = listMeta;
                }
            }
        }
        return metadata;
    } catch (error) {
        console.error("Error preparing metadata:", error);
        return {};
    }
}

export default async function Home() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;
    const reg = cookieStore.get("registered")?.value;
    const userName = cookieStore.get("username")?.value;
    const id = cookieStore.get("id")?.value;

    let isRegistered = false;
    if (reg === "yes") {
        isRegistered = true;
    }

    let lists = [];
    let metadata = {};

    try {
        if (id && token) {
            lists = await getShoppingList(id, token);
            metadata = await prepareMetadata(lists, id);
        }
    } catch (error) {
        console.error("Error fetching initial data:", error);
    }

    return (
        <HomeClient
            isRegistered={isRegistered}
            userName={userName}
            lists={lists}
            serverToken={token}
            userId={id}
            metadata={metadata}
        />
    );
}
