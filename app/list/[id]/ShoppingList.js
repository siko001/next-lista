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
import ShoppingListHeader from '../../components/parts/ShoppingListHeader';
import Product from '../../components/parts/Product';



export default function ShoppingList({ isRegistered, userName, list, token, products }) {
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

    useEffect(() => {
        const fetchAllData = async () => {
            if (!shoppingListId || !token) return;
            const decryptedToken = decryptToken(token);

            try {
                // 1. Fetch ALL products
                const products = await fetchProducts(token);
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

            <div className=" relatve px-4">

                <ShoppingListHeader list={list} />


                <div className="flex flex-col gap-6">
                    {
                        // Actual products (live data)
                        checkedProducts?.length ? checkedProducts.map((product, index) => (
                            //    Skip the product if it is 0
                            product === 0 ? null
                                :
                                (
                                    <Product product={product} key={index} />
                                )
                        ))
                            // static products from server (fallback first to load)
                            :
                            products?.map((product, index) => (
                                //    Skip the product if it is 0
                                product === 0 ? null
                                    :
                                    (
                                        <Product product={product} key={index} />
                                    )
                            ))
                    }
                </div>

            </div>

            {overlay && <Overlay />}

            {loading && <div className=" fixed z-[9999] top-0 left-0 w-full h-full bg-[#00000055] flex items-center justify-center text-xl text-white">  <ListLoader />  </div>}

            {productOverlay && <AddProduct allProducts={allProducts} checkedProducts={checkedProducts} setCheckedProducts={setCheckedProducts} token={token} setProductOverlay={setProductOverlay} />}

            <Notification />


            <div className="open-product-overlay opacity-0 fixed bottom-8 md:bottom-12 left-[50%] translate-x-[-50%] z-20">
                <Button cta="Add Products" color="#21ba9c" hover="inwards" action="add-product-overlay" textColorOverride={"text-white"} setProductOverlay={setProductOverlay} />
            </div>
        </main >

    )
}