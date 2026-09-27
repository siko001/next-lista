import ShoppingList from "./ShoppingList";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";

import {
    getListDetails,
    getLinkedProducts,
    getAllProducts,
} from "../../lib/helpers";

export default async function Page({params}) {
    const {id: listId} = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const reg = cookieStore.get("registered")?.value;
    const userName = cookieStore.get("username")?.value;
    const userId = cookieStore.get("id")?.value;

    let isRegistered = false;
    if (reg === "yes") {
        isRegistered = true;
    }

    // Only the list and catalogue are needed to render this page. Personal
    // product choices load when the product picker opens.
    const [list, products, AllProducts] =
        await Promise.all([
            getListDetails(listId, token),
            getLinkedProducts(listId, token),
            getAllProducts(token),
        ]);

    // if the list is not found, redirect to the home page
    if (!products.success) {
        redirect("/");
    }

    return (
        <ShoppingList
            listId={listId}
            userId={userId}
            AllProducts={AllProducts}
            baggedItems={products}
            isRegistered={isRegistered}
            userName={userName}
            list={list}
            ownerName={list?.owner_name}
            token={token}
            checkedProductList={products.checkedProducts}
            products={products.linkedProducts}
            userCustomProducts={null}
            favourites={null}
        />
    );
}
