import ShoppingList from "./ShoppingList";
import {cookies} from "next/headers";

import {
    getListDetails,
    getLinkedProducts,
    getAllProducts,
    getAllCustomProducts,
    getFavourites,
} from "../../lib/helpers";

export default async function Page() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const reg = cookieStore.get("registered")?.value;
    const userName = cookieStore.get("username")?.value;
    const listId = cookieStore.get("listId")?.value;
    const userId = cookieStore.get("id")?.value;

    let isRegistered = false;
    if (reg === "yes") {
        isRegistered = true;
    }

    // Fetch all data in parallel
    const [list, products, AllProducts, customProducts, favourites] =
        await Promise.all([
            getListDetails(listId, token),
            getLinkedProducts(listId, token),
            getAllProducts(token),
            getAllCustomProducts(token),
            getFavourites(token),
        ]);

    return (
        <ShoppingList
            listId={listId}
            userId={userId}
            AllProducts={AllProducts}
            baggedItems={products}
            isRegistered={isRegistered}
            userName={userName}
            list={list}
            token={token}
            checkedProductList={products.checkedProducts}
            products={products.linkedProducts}
            userCustomProducts={customProducts}
            favourites={favourites}
        />
    );
}
