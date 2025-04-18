'use client'
import gsap from 'gsap';
import { useParams } from 'next/navigation'
import { useEffect, useState } from "react";
import { calculateProgress, WP_API_BASE, decryptToken } from "../../lib/helpers"

// Contexts
import { useNotificationContext } from "../../contexts/NotificationContext";
import { useOverlayContext } from "../../contexts/OverlayContext";
import { useProductContext } from "../../contexts/ProductContext";

// Components
import Header from "../../components/Header";
import Notification from '../../components/Notification';
import Button from '../../components/Button';
import AddProduct from '../../components/modals/AddProduct';
import ShoppingListHeader from '../../components/parts/ShoppingListHeader';
import Product from '../../components/parts/Product';
import ShareListDialog from '../../components/modals/ShareListDialog';
import Overlay from "../../components/modals/Overlay";

// Icons
import SettingsIcon from '../../components/svgs/SettingsIcon';
import BagIcon from '../../components/svgs/BagIcon';
import XBagIcon from '../../components/svgs/XBagIcon';
import EmptyBagIcon from '../../components/svgs/EmptyBagIcon';


export default function ShoppingList({ isRegistered, userName, list, token, baggedItems, checkedProductList, AllProducts }) {


    const { overlay } = useOverlayContext();


    const [productOverlay, setProductOverlay] = useState(false);

    const [allLinkedProducts, setAllLinkedProducts] = useState(list.acf.linked_products);
    const [checkedProducts, setCheckedProducts] = useState(checkedProductList);
    const [baggedProducts, setBaggedProducts] = useState(baggedItems.baggedProducts);

    const [allProducts, setAllProducts] = useState(AllProducts);
    const [shareDialogOpen, setShareDialogOpen] = useState(false)


    const [checklistSettings, setChecklistSettings] = useState(false);
    const [baggedSettings, setBaggedSettings] = useState(false);


    const [totalProductCount, setTotalProductCount] = useState(Number(list?.acf?.product_count) || 0);
    const [baggedProductCount, setBaggedProductCount] = useState(Number(list?.acf?.bagged_product_count) || 0);

    const [progress, setProgress] = useState(calculateProgress(totalProductCount, baggedProductCount) || 0);

    // const fetchProducts = async (token) => {
    //     return await getAllProducts(token);
    // }


    // useEffect(() => {
    //     const fetchAllData = async () => {
    //         if (!shoppingListId || !token) return;
    //         try {
    //             // 1. Fetch ALL products
    //             const allProducts = await fetchProducts(token);
    //             setAllProducts(allProducts);
    //         } catch (error) {
    //             console.error('Error:', error);
    //         }
    //     };

    //     fetchAllData();
    // }, [shoppingListId, token]);



    const handleOpenChecklistSettings = () => {
        setChecklistSettings((prev) => !prev);
    }

    const handleOpenBaggedSettings = () => {
        setBaggedSettings((prev) => !prev);
    }


    useEffect(() => {
        // Close the checklist settings when clicking outside
        const handleClickOutside = (event) => {
            if (event.target.closest('.checklist-settings') === null) {
                setChecklistSettings(false);
            }
            if (event.target.closest('.bagged-settings') === null) {
                setBaggedSettings(false);
            }
        };

        // close if esc is pressed  
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setChecklistSettings(false);
                setBaggedSettings(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('click', handleClickOutside);
        };
    })

    // Update progress when baggedProductCount or totalProductCount changes
    useEffect(() => {
        if (totalProductCount === 0) setProgress(0)
        if (baggedProductCount === 0) setProgress(0)

        const newProgress = calculateProgress(totalProductCount, baggedProductCount);
        setProgress(newProgress);
    }, [totalProductCount, baggedProductCount])



    // Bag All Products
    const handleBagAllItems = async (listId) => {
        const container = document.querySelector('.checked-products-container');

        // Add fade-out animation to all checked products
        if (container) {
            gsap.to(container.children, {
                opacity: 0,
                y: 60,
                duration: 0.3,
                stagger: 0.05,
                onComplete: updateStates
            });
        } else {
            updateStates();
        }

        function updateStates() {
            const baggedProducts = checkedProducts.map((product) => ({
                id: product.id,
                title: product.title,
            }));

            // Update state
            setBaggedProducts(prev => [...prev, ...baggedProducts]);
            setCheckedProducts([]);
            setBaggedProductCount(prev => prev + checkedProducts.length);

            // Send API request
            sendApiRequest(listId, baggedProducts);
        }

        async function sendApiRequest(listId, baggedProducts) {
            try {
                const decryptedToken = decryptToken(token);
                const res = await fetch(`${WP_API_BASE}/custom/v1/bag-all-products`, {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${decryptedToken}`
                    },
                    body: JSON.stringify({
                        shoppingListId: listId,
                        baggedProducts: baggedProducts,
                        action: 'bag'
                    }),
                });
            } catch (error) {
                console.error('Bagging error:', error);
                // Revert state on error
                setBaggedProducts(prev => prev.filter(p =>
                    !checkedProducts.some(cp => cp.id === p.id)
                ));
                setCheckedProducts(prev => [...prev, ...checkedProducts]);
                setBaggedProductCount(prev => prev - checkedProducts.length);
            }
        }
    }



    const handleUnbagAllProducts = async (listId) => {
        const container = document.querySelector('.bagged-products-container');

        // Add fade-out animation to all bagged products
        if (container) {
            gsap.to(container.children, {
                opacity: 0,
                y: -60,
                duration: 0.3,
                stagger: 0.05,
                onComplete: updateStates
            });
        } else {
            updateStates();
        }

        function updateStates() {
            // Get all currently bagged products
            const productsToUnbag = [...baggedProducts];

            // Update state - move all bagged products back to checked
            setCheckedProducts(prev => [...prev, ...productsToUnbag]);
            setBaggedProducts([]);
            setBaggedProductCount(0);

            // Send API request
            sendApiRequest(listId, productsToUnbag);
        }

        async function sendApiRequest(listId, productsToUnbag) {
            try {
                const decryptedToken = decryptToken(token);
                const res = await fetch(`${WP_API_BASE}/custom/v1/unbag-all-products`, {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${decryptedToken}`
                    },
                    body: JSON.stringify({
                        shoppingListId: listId,
                        baggedProducts: productsToUnbag,
                        action: 'unbag'
                    }),
                });

                console.log(res)
            } catch (error) {
                console.error('Unbagging error:', error);
                // Revert state on error
                setCheckedProducts(prev => prev.filter(p =>
                    !baggedProducts.some(bp => bp.id === p.id)
                ));
                setBaggedProducts(prev => [...prev, ...baggedProducts]);
                setBaggedProductCount(baggedProducts.length);
            }
        }
    }


    // REMOVE ALL CHECKED AND LINKED PRODUCTS
    const handleRemoveCheckedItems = async (listId) => {
        const container = document.querySelector('.checked-products-container');
        const productsToRemove = [...checkedProducts]; // Create a copy of checked products

        // Add fade-out animation to all checked products
        if (container) {
            gsap.to(container.children, {
                opacity: 0,
                y: 60,
                duration: 0.3,
                backgroundColor: '#ff0000',
                stagger: 0.05,
                onComplete: () => updateStates(productsToRemove)
            });
        } else {
            updateStates(productsToRemove);
        }

        function updateStates(productsToRemove) {
            // Update state - remove all checked products
            setCheckedProducts([]);
            setTotalProductCount(prev => prev - productsToRemove.length);
            setAllLinkedProducts(prev => prev.filter(p => !productsToRemove.some(r => r.id === p.ID)));
            // Also remove from bagged if any were bagged
            setBaggedProducts(prev => {
                const newBagged = prev.filter(p =>
                    !productsToRemove.some(r => r.id === p.id)
                );
                setBaggedProductCount(newBagged.length);
                return newBagged;
            });

            // Send API request
            sendApiRequest(listId, productsToRemove);
        }

        async function sendApiRequest(listId, productsToRemove) {
            try {
                const decryptedToken = decryptToken(token);
                const res = await fetch(`${WP_API_BASE}/custom/v1/remove-checked-products`, {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${decryptedToken}`
                    },
                    body: JSON.stringify({
                        shoppingListId: listId,
                        productsToRemove: productsToRemove,
                        action: 'remove'
                    }),
                });

                const data = await res.json();
                console.log('Removal successful:', data);

            } catch (error) {
                console.error('Removal error:', error);
                // Revert state on error
                setCheckedProducts(prev => [...prev, ...productsToRemove]);
                setTotalProductCount(prev => prev + productsToRemove.length);
            }
        }
    }


    // REMOVE ALL BAGGED PRODUCTS
    const handleRemoveBaggedItems = async (listId) => {
        const container = document.querySelector('.bagged-products-container');
        const productsToRemove = [...baggedProducts];

        // Add fade-out animation to all bagged products
        if (container) {
            gsap.to(container.children, {
                opacity: 0,
                y: 60,
                duration: 0.3,
                backgroundColor: '#ff0000',
                stagger: 0.05,
                onComplete: () => updateStates(productsToRemove)
            });
        } else {
            updateStates(productsToRemove);
        }

        function updateStates(productsToRemove) {
            // Update state - remove all bagged products
            setBaggedProducts([]);
            setBaggedProductCount(0);
            setTotalProductCount(prev => prev - productsToRemove.length);
            setAllLinkedProducts(prev => prev.filter(p => !productsToRemove.some(r => r.id === p.ID)));

            // Send API request
            sendApiRequest(listId, productsToRemove);
        }

        async function sendApiRequest(listId, productsToRemove) {
            try {
                const decryptedToken = decryptToken(token);
                const res = await fetch(`${WP_API_BASE}/custom/v1/remove-bagged-products`, {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${decryptedToken}`
                    },
                    body: JSON.stringify({
                        shoppingListId: listId,
                        productsToRemove: productsToRemove,
                        action: 'remove'
                    }),
                });

                const data = await res.json();
                console.log('Bagged products removal successful:', data);

            } catch (error) {
                console.error('Removal error:', error);
                // Revert state on error
                setBaggedProducts(prev => [...prev, ...productsToRemove]);
                setBaggedProductCount(productsToRemove.length);
                setTotalProductCount(prev => prev + productsToRemove.length);
            }
        }
    }




    return (
        <main >

            <Header isRegistered={isRegistered} userName={userName} />

            <div className="relatve px-4">

                <ShoppingListHeader setProgress={setProgress} setAllLinkedProducts={setAllLinkedProducts} setCheckedProducts={setCheckedProducts} setBaggedProducts={setBaggedProducts} progress={progress} setTotalProductCount={setTotalProductCount} setBaggedProductCount={setBaggedProductCount} Count setShareDialogOpen={setShareDialogOpen} token={token} list={list} />

                <div className="flex flex-col gap-4 w-full max-w-[740px] z-10 relative mx-auto mt-4 px-4 mb-32">

                    <div className="flex items-center justify-between sticky top-24 bg-[#0a0a0a] z-20 px-4 pt-4 pb-2">

                        {(checkedProducts && checkedProducts?.length !== 0) &&
                            (
                                <>
                                    <div className="bg-[#0a0a0a] h-10 blur-lg z-10 w-full  absolute -bottom-2.5  left-0"></div>
                                    <h3 onClick={handleOpenChecklistSettings} className="flex cursor-pointer relative z-20  gap-1 checklist-settings">
                                        <SettingsIcon className={`w-7 h-7  ${checklistSettings ? 'text-primary' : "text-gray-500 hover:text-gray-700"} transition-colors duration-200 `} />
                                        <div className="">
                                            <span className="text-2xl font-bold">Checklist </span>
                                            <span className="text-sm text-gray-500 ml-2">{checkedProducts?.length} products</span>
                                        </div>

                                        {
                                            checklistSettings && (
                                                <>
                                                    {/* Settings for checklist */}
                                                    <div className="absolute left-7 -top-2 mt-1  text-xs whitespace-nowrap py-1.5 px-1 shadow-[#00000055] rounded-sm bg-gray-200 dark:bg-gray-700 shadow-md z-30">
                                                        <div className="flex flex-col gap-0.5">

                                                            <button onClick={() => handleBagAllItems(list.id)} className="px-1 py-1 items-center flex hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm">
                                                                <BagIcon className="w-5 h-5 inline-block mr-1 text-neutral-900" />
                                                                Bag All Items
                                                            </button>
                                                            <button onClick={() => { handleRemoveCheckedItems(list.id) }} className="px-1 py-1 cursor-pointer items-center flex hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors text-red-600 rounded-sm">
                                                                <XBagIcon className="w-5 h-5 inline-block mr-1 text-red-700" />
                                                                Remove All Items
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )
                                        }

                                    </h3>
                                </>
                            )
                        }
                    </div>
                    <div className="checked-products-container flex flex-col gap-4">
                        { /* Products */}
                        {checkedProducts?.length !== 0 && checkedProducts?.map((product, index) => (
                            product === 0 ? null : <Product setBaggedProductCount={setBaggedProductCount} totalProductCount={totalProductCount} baggedProductCount={baggedProductCount} setProgress={setProgress} setCheckedProducts={setCheckedProducts} isBagged={false} setBaggedProducts={setBaggedProducts} token={token} product={product} key={index} />
                        ))}
                    </div>

                    <div className={`flex items-center justify-between sticky top-24 bg-[#0a0a0a] z-20 px-4 pt-4 pb-2 ${checkedProducts?.length !== 0 ? 'mt-10' : 'mt-0'} py-2 z-20 px-4 `}>
                        {(
                            baggedProducts && baggedProducts?.length !== 0) &&
                            (
                                <>
                                    <div className="bg-[#0a0a0a] h-10 blur-lg z-10 w-full  absolute -bottom-2.5  left-0"></div>
                                    <h3 onClick={handleOpenBaggedSettings} className={`flex cursor-pointer relative z-20  gap-1 bagged-settings`}>
                                        <SettingsIcon className={`w-7 h-7   ${baggedSettings ? 'text-primary' : "text-gray-500 hover:text-gray-700"}  transition-colors duration-200 `} />
                                        <div>
                                            <span className="text-2xl font-bold">Bagged</span>
                                            <span className="text-sm text-gray-500 ml-2">{baggedProducts?.length !== 0 ? baggedProducts?.length : baggedItems.baggedCount !== 0 && baggedItems.baggedCount} products</span>
                                        </div>

                                        {
                                            baggedSettings && (
                                                <>
                                                    {/* Settings for checklist */}
                                                    <div className="absolute left-7 -top-2 mt-1  text-xs whitespace-nowrap py-1.5 px-1 shadow-[#00000055] rounded-sm bg-gray-200 dark:bg-gray-700 shadow-md z-30">
                                                        <div className="flex flex-col gap-0.5">
                                                            <button onClick={() => { handleUnbagAllProducts(list.id) }} className="px-1 py-1 items-center flex hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm">
                                                                <EmptyBagIcon className="w-5 h-5 inline-block mr-1 text-neutral-900" />
                                                                Unbag All Items
                                                            </button>
                                                            <button onClick={() => { handleRemoveBaggedItems(list.id) }} className="px-1 py-1 cursor-pointer items-center flex hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors text-red-600 rounded-sm">
                                                                <XBagIcon className="w-5 h-5 inline-block mr-1 text-red-700" />
                                                                Remove All Items
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )
                                        }
                                    </h3>
                                </>
                            )}
                    </div>

                    {/* Products */}
                    <div className="bagged-products-container flex flex-col gap-4">
                        {baggedProducts?.length !== 0 && baggedProducts?.map((product, index) => (
                            product === 0 ? null : <Product setBaggedProductCount={setBaggedProductCount} totalProductCount={totalProductCount} baggedProductCount={baggedProductCount} setProgress={setProgress} setCheckedProducts={setCheckedProducts} setBaggedProducts={setBaggedProducts} isBagged={true} token={token} product={product} key={index} />
                        ))}
                    </div>

                </div >

            </div >




            {productOverlay && <AddProduct baggedProducts={baggedProducts} progress={progress} setProgress={setProgress} baggedProductCount={baggedProductCount} setBaggedProductCount={setBaggedProductCount} totalProductCount={totalProductCount} setTotalProductCount={setTotalProductCount} allLinkedProducts={allLinkedProducts} setAllLinkedProducts={setAllLinkedProducts} setBaggedProducts={setBaggedProducts} allProducts={allProducts} setCheckedProducts={setCheckedProducts} token={token} setProductOverlay={setProductOverlay} />}

            <Notification />

            <div className="open-product-overlay opacity-0 fixed bottom-8 left-[50%] translate-x-[-50%] z-50">
                <Button cta="Add Products" color="#21ba9c" hover="inwards" action="add-product-overlay" textColorOverride={"text-white"} overrideDefaultClasses={"bg-blue-800 text-black text-sm md:text-base"} setProductOverlay={setProductOverlay} />
            </div>

            <div className="w-full fixed -bottom-10 left-0  blur-xl z-40 bg-black py-14  px-4 flex items-center justify-between"></div>


            {
                shareDialogOpen && (
                    <ShareListDialog
                        listId={shareDialogOpen}
                        onClose={() => setShareDialogOpen(null)}
                    />
                )
            }

        </main >
    )
}