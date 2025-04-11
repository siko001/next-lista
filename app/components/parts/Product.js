'use client'
import { useParams } from 'next/navigation'
import { decryptToken, WP_API_BASE } from "../../lib/helpers";

export default function Product({ product, token }) {
    const shoppingListId = useParams().id;

    const updateProductInBaggedList = async (productId, isAdding, token) => {
        if (!shoppingListId || !token) return;
        const decryptedToken = decryptToken(token);

        try {

            const response = await fetch(`${WP_API_BASE}/custom/v1/update-bagged-products`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${decryptedToken}`
                },
                body: JSON.stringify({
                    shoppingListId,
                    productId,
                    action: isAdding ? 'add' : 'remove'
                }),
            });


            console.log("response", response);
            const data = await response.json();
            console.log("data", data);
            // Assuming you have a state variable for bagged products
            // setBaggedProducts(data.currentBaggedProducts);

        } catch (error) {
            // console.error('Error:', error);
            // Handle error as needed
        }
    };


    return (
        <div className="flex  text-center w-full mx-auto items-center justify-between gap-12 px-2 py-4 bg-gray-800 rounded-lg">
            <div onClick={() => updateProductInBaggedList(product.id, 'add', token)} className="flex items-center gap-4">
                <h3 className="text-lg font-semibold">{product.title}</h3>
            </div>
        </div>
    )
}