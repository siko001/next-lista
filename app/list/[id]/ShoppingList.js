'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import gsap from 'gsap';
import { decryptToken } from "../../lib/helpers";

// Contexts
import { useUserContext } from "../../contexts/UserContext";
import { useListContext } from "../../contexts/ListContext";
import { useOverlayContext } from "../../contexts/OverlayContext";
import { useLoadingContext } from "../../contexts/LoadingContext";
import { useNotificationContext } from "../../contexts/NotificationContext";
import { useProductContext } from "../../contexts/ProductContext";

// Icons
import SettingsIcon from '../../components/svgs/SettingsIcon';
import SearchIcon from '../../components/svgs/SearchIcon';

// Components
import Header from "../../components/Header";
import ListLoader from '../../components/loaders/ListLoader';
import Overlay from '../../components/modals/Overlay';
import Notification from '../../components/Notification';
import Progressbar from '../../components/parts/Progressbar';
import Button from '../../components/Button';
import AddProduct from '../../components/modals/AddProduct';



export default function ShoppingList({ isRegistered, userName, list, token }) {
    const WP_API_BASE = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';
    const { loading } = useLoadingContext();
    const { overlay } = useOverlayContext();
    const { getAllProducts } = useProductContext();
    const [productOverlay, setProductOverlay] = useState(false);
    const [checkedProducts, setCheckedProducts] = useState([]);
    const shoppingListId = useParams().id;
    const [allProducts, setAllProducts] = useState([]);

    const fetchProducts = async (token) => {
        return await getAllProducts(token);
    }

    useEffect(() => {
        // fetchProducts(token)
        gsap.set(".open-product-overlay", {
            y: 200,
            opacity: 1,
        })
        gsap.to(".open-product-overlay", {
            y: 0,
            duration: 0.5,
            ease: "power2.out",
        })
    }, [])


    // // Add this useEffect to fetch initial checked products
    // useEffect(() => {
    //     const fetchLinkedProducts = async () => {
    //         if (!shoppingListId || !token) return;
    //         const decryptedToken = decryptToken(token);

    //         try {
    //             const response = await fetch(
    //                 `${WP_API_BASE}/custom/v1/get-shopping-list-products?shoppingListId=${shoppingListId}`,
    //                 {
    //                     method: 'GET',
    //                     headers: {
    //                         "Authorization": `Bearer ${decryptedToken}`
    //                     }
    //                 }
    //             );

    //             if (!response.ok) {
    //                 throw new Error('Failed to fetch linked products');
    //             }

    //             const data = await response.json();
    //             setCheckedProducts(data.linkedProducts || []);
    //         } catch (error) {
    //             console.error('Error fetching linked products:', error);
    //         }
    //     };

    //     fetchLinkedProducts();
    // }, [shoppingListId, token]);


    // Combine both product fetches into one useEffect
    useEffect(() => {
        const fetchAllData = async () => {
            if (!shoppingListId || !token) return;
            const decryptedToken = decryptToken(token);

            try {
                // 1. Fetch ALL products
                const products = await fetchProducts(token);
                console.log('Fetched products:', products);
                setAllProducts(products);

                // 2. Fetch linked products for THIS list
                const response = await fetch(
                    `${WP_API_BASE}/custom/v1/get-shopping-list-products?shoppingListId=${shoppingListId}`,
                    {
                        headers: {
                            "Authorization": `Bearer ${decryptedToken}`
                        }
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    console.log('Fetched linked products:', data.linkedProducts);
                    setCheckedProducts(data.linkedProducts);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        };

        fetchAllData();
    }, [shoppingListId, token]);


    return (
        <main >

            <Header isRegistered={isRegistered} userName={userName} />

            <div className=" relatve h-[300vh] px-4">
                <div className="w-full  flex flex-col gap-6  rounded-b-3xl md:min-w-[550px] py-4 px-6 max-[850px] md:w-1/2 bg-gray-900 h-[100px] mx-auto sticky top-0 z-10">
                    {/* list name */}
                    <div className="flex items-center justify-between gap-12 px-2">
                        <h2 className="text-xl md:text-2xl font-bold">{list.title}</h2>

                        <div className="flex gap-6 items-center">

                            <SearchIcon className="w-6 h-6 md:w-8 md:h-8 dark:text-gray-600 text-gray-800 hover:text-gray-400 duration-200 transition-colors cursor-pointer" />

                            <SettingsIcon className="w-6 h-6 md:w-8 md:h-8 dark:text-gray-600 text-gray-800 hover:text-gray-400 duration-200 transition-colors cursor-pointer" />
                        </div>

                    </div>
                    <Progressbar progress={0} />
                </div>

                <div className="flex flex-col gap-6">
                    {[].map((product, index) => (
                        < div key={index} className="flex min-w-[300px] text-center max-w-[300px] mx-auto items-center justify-between gap-12 px-2 py-4 bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-semibold">{product.title}</h3>
                            </div>
                        </div>
                    )) || []}
                </div>

            </div>

            {overlay && <Overlay />}

            <div className="open-product-overlay opacity-0 fixed bottom-8 md:bottom-12 left-[50%] translate-x-[-50%] z-20">
                <Button cta="Add Products" color="#21ba9c" hover="inwards" action="add-product-overlay" textColorOverride={"text-white"} setProductOverlay={setProductOverlay} />
            </div>


            {loading && <div className=" fixed z-[9999] top-0 left-0 w-full h-full bg-[#00000055] flex items-center justify-center text-xl text-white">  <ListLoader />  </div>}

            {productOverlay && <AddProduct allProducts={allProducts} checkedProducts={checkedProducts} setCheckedProducts={setCheckedProducts} token={token} setProductOverlay={setProductOverlay} />}

            <Notification />
        </main >

    )
}