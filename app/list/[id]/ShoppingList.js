"use client";
import gsap from "gsap";
import {useEffect, useState, useMemo, useRef} from "react";
import Fuse from "fuse.js";
import {calculateProgress, WP_API_BASE, decryptToken} from "../../lib/helpers";
import {
    getUniqueCategories,
    groupProductsByCategory,
} from "../../lib/categoryHelpers";

// Contexts
import {useNotificationContext} from "../../contexts/NotificationContext";
import {useListContext} from "../../contexts/ListContext";

// Websockets
import useListaRealtimeUpdates from "../../lib/RealTimeUpdates";
import useRealtimeRename from "../../lib/RealtimeRename";
import useRealtimeListDelete from "../../lib/DeleteListRealtime";

// Components
import Header from "../../components/Header";
import Notification from "../../components/Notification";
import Button from "../../components/Button";
import AddProduct from "../../components/modals/AddProduct";
import ShoppingListHeader from "../../components/parts/ShoppingListHeader";
import Product from "../../components/parts/Product";
import ShareListDialog from "../../components/modals/ShareListDialog";

// Icons
import SettingsIcon from "../../components/svgs/SettingsIcon";
import BagIcon from "../../components/svgs/BagIcon";
import XBagIcon from "../../components/svgs/XBagIcon";
import EmptyBagIcon from "../../components/svgs/EmptyBagIcon";

export default function ShoppingList({
    listId,
    userId,
    isRegistered,
    userName,
    list: initialList,
    token,
    baggedItems,
    checkedProductList,
    AllProducts,
    userCustomProducts,
    favourites,
    ownerName,
}) {
    const [productOverlay, setProductOverlay] = useState(false);
    const [currentList, setCurrentList] = useState(initialList);

    // general products
    const [allLinkedProducts, setAllLinkedProducts] = useState(
        currentList?.acf?.linked_products
    );
    const [checkedProducts, setCheckedProducts] = useState(checkedProductList);
    const [baggedProducts, setBaggedProducts] = useState(
        baggedItems.baggedProducts
    );

    // custom products
    const [customProducts, setCustomProducts] = useState(userCustomProducts);

    // Store original product lists for search functionality
    const [originalCheckedProducts, setOriginalCheckedProducts] =
        useState(checkedProductList);
    const [originalBaggedProducts, setOriginalBaggedProducts] = useState(
        baggedItems.baggedProducts
    );

    const [allProducts, setAllProducts] = useState(AllProducts);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [checklistSettings, setChecklistSettings] = useState(false);
    const [sharedWithUsers, setSharedWithUsers] = useState(
        currentList?.acf?.shared_with_users || []
    );
    const [baggedSettings, setBaggedSettings] = useState(false);

    const [totalProductCount, setTotalProductCount] = useState(
        Number(currentList?.acf?.product_count) || 0
    );
    const [baggedProductCount, setBaggedProductCount] = useState(
        Number(currentList?.acf?.bagged_product_count) || 0
    );
    const [progress, setProgress] = useState(
        calculateProgress(totalProductCount, baggedProductCount) || 0
    );
    const {setIsInnerList, isInInnerList, setUserLists} = useListContext();

    // Get Categories
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        const uniqueCategories = getUniqueCategories(allProducts);
        setCategories(uniqueCategories);
    }, [allProducts]);

    // Close the corresposing settings if scrolling and open
    const checkedListSettings = useRef();
    const baggedListSettings = useRef();
    const lastScrollY = useRef(0);
    const [isScrolling, setIsScrolling] = useState(false);
    useEffect(() => {
        setIsInnerList(true);
        if (typeof window === "undefined") return;
        let scrollTimeout;
        lastScrollY.current = window.scrollY;

        const handleScroll = () => {
            const currentScroll = window.scrollY;
            const scrollDiff = Math.abs(currentScroll - lastScrollY.current);

            if (scrollDiff > 6) {
                if (checklistSettings) {
                    setChecklistSettings(false);
                }
                if (baggedSettings) {
                    setBaggedSettings(false);
                }
            }
            lastScrollY.current = currentScroll;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                setIsScrolling(false);
            }, 150);

            setIsScrolling(true);
        };
        window.addEventListener("scroll", handleScroll, {passive: true});
        return () => {
            window.removeEventListener("scroll", handleScroll);
            clearTimeout(scrollTimeout);
        };
    }, [
        checklistSettings,
        baggedSettings,
        setChecklistSettings,
        setBaggedSettings,
    ]);

    const {showNotification} = useNotificationContext();
    // Create Fuse instances for fuzzy search
    const fuseCheckedOptions = {
        keys: ["title"],
        threshold: 0.4, // Lower threshold means more strict matching
        distance: 100, // How far to extend the fuzzy match
    };

    const fuseChecked = useMemo(
        () => new Fuse(originalCheckedProducts, fuseCheckedOptions),
        [originalCheckedProducts]
    );
    const fuseBagged = useMemo(
        () => new Fuse(originalBaggedProducts, fuseCheckedOptions),
        [originalBaggedProducts]
    );

    // Update original product lists when primary lists change (outside of search)
    useEffect(() => {
        if (checkedProducts && !isSearching) {
            setOriginalCheckedProducts([...checkedProducts]);
        }
    }, [checkedProducts]);

    useEffect(() => {
        if (baggedProducts && !isSearching) {
            setOriginalBaggedProducts([...baggedProducts]);
        }
    }, [baggedProducts]);

    // Track if we're currently searching
    const [isSearching, setIsSearching] = useState(false);

    // Handle search functionality with fuzzy matching
    const handleSearchProducts = (searchTerm) => {
        if (searchTerm === "") {
            // If search is cleared, restore original lists
            setCheckedProducts([...originalCheckedProducts]);
            setBaggedProducts([...originalBaggedProducts]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        // Use Fuse.js to perform fuzzy search on both lists
        const filteredCheckedProducts = fuseChecked
            .search(searchTerm)
            .map((result) => result.item);
        const filteredBaggedProducts = fuseBagged
            .search(searchTerm)
            .map((result) => result.item);

        // Update the state with filtered results
        setCheckedProducts(filteredCheckedProducts);
        setBaggedProducts(filteredBaggedProducts);
    };

    const handleOpenChecklistSettings = () => {
        setChecklistSettings((prev) => !prev);
    };

    const handleOpenBaggedSettings = () => {
        setBaggedSettings((prev) => !prev);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target.closest(".checklist-settings") === null) {
                setChecklistSettings(false);
            }
            if (event.target.closest(".bagged-settings") === null) {
                setBaggedSettings(false);
            }
        };

        // close if esc is pressed
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setChecklistSettings(false);
                setBaggedSettings(false);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("click", handleClickOutside);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("click", handleClickOutside);
        };
    }, []);

    // Update progress when baggedProductCount or totalProductCount changes
    useEffect(() => {
        if (totalProductCount === 0) setProgress(0);
        if (baggedProductCount === 0) setProgress(0);
        const newProgress = calculateProgress(
            totalProductCount,
            baggedProductCount
        );
        setProgress(newProgress);
    }, [
        totalProductCount,
        baggedProductCount,
        checkedProducts,
        baggedProducts,
    ]);

    // Bag All Products
    const handleBagAllItems = async (listId) => {
        const container = document.querySelector(".checked-products-container");

        // Add fade-out animation to all checked products
        if (container) {
            gsap.to(container.children, {
                opacity: 0,
                y: 60,
                duration: 0.3,
                stagger: 0.05,
                onComplete: updateStates,
            });
            showNotification("Products Bagged", "success", 1000);
        } else {
            updateStates();
        }

        function updateStates() {
            const baggedProducts = checkedProducts.map((product) => ({
                id: product.id,
                title: product.title,
            }));

            // Update state
            setBaggedProducts((prev) => [...prev, ...baggedProducts]);
            setCheckedProducts([]);
            setBaggedProductCount((prev) => prev + checkedProducts.length);

            // Also update original states if not searching
            if (!isSearching) {
                setOriginalBaggedProducts((prev) => [
                    ...prev,
                    ...baggedProducts,
                ]);
                setOriginalCheckedProducts([]);
            }

            // Send API request
            sendApiRequest(listId, baggedProducts);
        }

        async function sendApiRequest(listId, baggedProducts) {
            try {
                const decryptedToken = decryptToken(token);
                const res = await fetch(
                    `${WP_API_BASE}/custom/v1/bag-all-products`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${decryptedToken}`,
                        },
                        body: JSON.stringify({
                            shoppingListId: listId,
                            baggedProducts: baggedProducts,
                            action: "bag",
                        }),
                    }
                );
            } catch (error) {
                console.error("Bagging error:", error);
                // Revert state on error
                setBaggedProducts((prev) =>
                    prev.filter(
                        (p) => !checkedProducts.some((cp) => cp.id === p.id)
                    )
                );
                setCheckedProducts((prev) => [...prev, ...checkedProducts]);
                setBaggedProductCount((prev) => prev - checkedProducts.length);
            }
        }
    };

    const handleUnbagAllProducts = async (listId) => {
        const container = document.querySelector(".bagged-products-container");
        // Add fade-out animation to all bagged products
        if (container) {
            gsap.to(container.children, {
                opacity: 0,
                y: -60,
                duration: 0.3,
                stagger: 0.05,
                onComplete: updateStates,
            });
            showNotification("Products Unbagged", "success", 1000);
        } else {
            updateStates();
        }

        function updateStates() {
            // Get all currently bagged products
            const productsToUnbag = [...baggedProducts];

            // Update state - move all bagged products back to checked
            setCheckedProducts((prev) => [...prev, ...productsToUnbag]);
            setBaggedProducts([]);
            setBaggedProductCount(0);

            // Also update original states if not searching
            if (!isSearching) {
                setOriginalCheckedProducts((prev) => [
                    ...prev,
                    ...productsToUnbag,
                ]);
                setOriginalBaggedProducts([]);
            }

            // Send API request
            sendApiRequest(listId, productsToUnbag);
        }

        async function sendApiRequest(listId, productsToUnbag) {
            try {
                const decryptedToken = decryptToken(token);
                const res = await fetch(
                    `${WP_API_BASE}/custom/v1/unbag-all-products`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${decryptedToken}`,
                        },
                        body: JSON.stringify({
                            shoppingListId: listId,
                            baggedProducts: productsToUnbag,
                            action: "unbag",
                        }),
                    }
                );
            } catch (error) {
                console.error("Unbagging error:", error);
                // Revert state on error
                setCheckedProducts((prev) =>
                    prev.filter(
                        (p) => !baggedProducts.some((bp) => bp.id === p.id)
                    )
                );
                setBaggedProducts((prev) => [...prev, ...baggedProducts]);
                setBaggedProductCount(baggedProducts.length);
            }
        }
    };

    // REMOVE ALL CHECKED AND LINKED PRODUCTS
    const handleRemoveCheckedItems = async (listId) => {
        const container = document.querySelector(".checked-products-container");
        const productsToRemove = [...checkedProducts]; // Create a copy of checked products

        // Add fade-out animation to all checked products
        if (container) {
            gsap.to(container.children, {
                opacity: 0,
                y: 60,
                duration: 0.3,
                backgroundColor: "#ff0000",
                stagger: 0.05,
                onComplete: () => updateStates(productsToRemove),
            });
            showNotification("Products Removed", "success", 1000);
        } else {
            updateStates(productsToRemove);
        }

        function updateStates(productsToRemove) {
            // Update state - remove all checked products
            setCheckedProducts([]);
            setTotalProductCount((prev) => prev - productsToRemove.length);
            setAllLinkedProducts((prev) =>
                prev.filter((p) => !productsToRemove.some((r) => r.id === p.ID))
            );

            // Also update original checked products if not searching
            if (!isSearching) {
                setOriginalCheckedProducts([]);
            }

            // Also remove from bagged if any were bagged
            setBaggedProducts((prev) => {
                const newBagged = prev.filter(
                    (p) => !productsToRemove.some((r) => r.id === p.id)
                );
                setBaggedProductCount(newBagged.length);
                return newBagged;
            });

            // Update original bagged products if not searching
            if (!isSearching) {
                setOriginalBaggedProducts((prev) =>
                    prev.filter(
                        (p) => !productsToRemove.some((r) => r.id === p.id)
                    )
                );
            }

            // Send API request
            sendApiRequest(listId, productsToRemove);
        }

        async function sendApiRequest(listId, productsToRemove) {
            try {
                const decryptedToken = decryptToken(token);
                const res = await fetch(
                    `${WP_API_BASE}/custom/v1/remove-checked-products`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${decryptedToken}`,
                        },
                        body: JSON.stringify({
                            shoppingListId: listId,
                            productsToRemove: productsToRemove,
                            action: "remove",
                        }),
                    }
                );

                const data = await res.json();
            } catch (error) {
                console.error("Removal error:", error);
                // Revert state on error
                setCheckedProducts((prev) => [...prev, ...productsToRemove]);
                setTotalProductCount((prev) => prev + productsToRemove.length);
            }
        }
    };

    // REMOVE ALL BAGGED PRODUCTS
    const handleRemoveBaggedItems = async (listId) => {
        const container = document.querySelector(".bagged-products-container");
        const productsToRemove = [...baggedProducts];

        // Add fade-out animation to all bagged products
        if (container) {
            gsap.to(container.children, {
                opacity: 0,
                y: 60,
                duration: 0.3,
                backgroundColor: "#ff0000",
                stagger: 0.05,
                onComplete: () => updateStates(productsToRemove),
            });
            showNotification("Products Removed", "success", 1000);
        } else {
            updateStates(productsToRemove);
        }

        function updateStates(productsToRemove) {
            // Update state - remove all bagged products
            setBaggedProducts([]);
            setBaggedProductCount(0);
            setTotalProductCount((prev) => prev - productsToRemove.length);
            setAllLinkedProducts((prev) =>
                prev.filter((p) => !productsToRemove.some((r) => r.id === p.ID))
            );

            // Update original bagged products if not searching
            if (!isSearching) {
                setOriginalBaggedProducts([]);
            }

            // Send API request
            sendApiRequest(listId, productsToRemove);
        }

        async function sendApiRequest(listId, productsToRemove) {
            try {
                const decryptedToken = decryptToken(token);
                const res = await fetch(
                    `${WP_API_BASE}/custom/v1/remove-bagged-products`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${decryptedToken}`,
                        },
                        body: JSON.stringify({
                            shoppingListId: listId,
                            productsToRemove: productsToRemove,
                            action: "remove",
                        }),
                    }
                );

                const data = await res.json();
            } catch (error) {
                console.error("Removal error:", error);
                // Revert state on error
                setBaggedProducts((prev) => [...prev, ...productsToRemove]);
                setBaggedProductCount(productsToRemove.length);
                setTotalProductCount((prev) => prev + productsToRemove.length);
            }
        }
    };

    // Real time updating
    useListaRealtimeUpdates(listId, (data) => {
        if (!data || !data.fields || userId == data.sender_id) return;

        // Normalize the linked products to ensure consistent ID field
        if (Array.isArray(data.fields.linked_products)) {
            const normalizedLinkedProducts = data.fields.linked_products.map(
                (product) => ({
                    ...product,
                    id: product.ID || product.id, // Ensure both ID and id exist
                    ID: product.ID || product.id,
                })
            );
            setAllLinkedProducts(normalizedLinkedProducts);
        }

        // Update other products
        if (Array.isArray(data.fields.checked_products)) {
            const normalizedCheckedProducts = data.fields.checked_products.map(
                (product) => ({
                    ...product,
                    id: product.ID || product.id,
                    ID: product.ID || product.id,
                })
            );
            setCheckedProducts(normalizedCheckedProducts);
        }

        if (Array.isArray(data.fields.bagged_linked_products)) {
            const normalizedBaggedProducts =
                data.fields.bagged_linked_products.map((product) => ({
                    ...product,
                    id: product.ID || product.id,
                    ID: product.ID || product.id,
                }));
            setBaggedProducts(normalizedBaggedProducts);
        }

        // Update counts
        if (data.fields.product_count !== undefined) {
            setTotalProductCount(Number(data.fields.product_count));
        }
        if (data.fields.bagged_product_count !== undefined) {
            setBaggedProductCount(Number(data.fields.bagged_product_count));
        }

        // Show notification
        if (data.message) {
            showNotification(data.message);
        }
    });

    // Handle being removed from shared list and other share updates
    useEffect(() => {
        if (!userId) return;
        const pusher = new Pusher("a9f747a06cd5ec1d8c62", {
            cluster: "eu",
        });

        const channel = pusher.subscribe("user-lists-" + userId);

        channel.bind("share-update", (data) => {
            // If we're the one being removed
            if (
                data.action === "remove" &&
                parseInt(data.userId) === parseInt(userId) &&
                parseInt(data.listId) === parseInt(listId)
            ) {
                showNotification("You were removed from this list", "info");
                // Store removal data for home page
                const removeData = {
                    listId: data.listId,
                    userId: data.userId,
                    token: token,
                };
                sessionStorage.setItem(
                    "removeListData",
                    JSON.stringify(removeData)
                );
                window.location.href = "/";
            }
            // If someone else was removed from this list
            else if (
                data.action === "remove" &&
                parseInt(data.listId) === parseInt(listId)
            ) {
                // Update shared users state
                const updatedUsers = (
                    currentList?.acf?.shared_with_users || []
                ).filter((user) => user.ID !== parseInt(data.userId));

                // Update both the list and shared users state
                setCurrentList((prevList) => ({
                    ...prevList,
                    acf: {
                        ...prevList.acf,
                        shared_with_users: updatedUsers,
                    },
                }));
                setSharedWithUsers(updatedUsers);

                // Update the list context
                setUserLists((prevLists) =>
                    prevLists.map((l) =>
                        parseInt(l.id) === parseInt(listId)
                            ? {
                                  ...l,
                                  acf: {
                                      ...l.acf,
                                      shared_with_users: updatedUsers,
                                  },
                              }
                            : l
                    )
                );
            }
            // If someone was added to this list
            else if (
                data.action === "add" &&
                parseInt(data.listId) === parseInt(listId)
            ) {
                const newUser = {
                    ID: parseInt(data.userId),
                    nickname: data.userName,
                };

                // Update shared users state
                const updatedUsers = [
                    ...(currentList?.acf?.shared_with_users || []),
                    newUser,
                ];

                // Update both the list and shared users state
                setCurrentList((prevList) => ({
                    ...prevList,
                    acf: {
                        ...prevList.acf,
                        shared_with_users: updatedUsers,
                    },
                }));
                setSharedWithUsers(updatedUsers);

                // Update the list context
                setUserLists((prevLists) =>
                    prevLists.map((l) =>
                        parseInt(l.id) === parseInt(listId)
                            ? {
                                  ...l,
                                  acf: {
                                      ...l.acf,
                                      shared_with_users: updatedUsers,
                                  },
                              }
                            : l
                    )
                );

                // Always show notification for new user, regardless of owner status
                showNotification(
                    `${data.userName} was added to the list`,
                    "success"
                );
            }
        });

        return () => {
            channel.unbind_all();
            pusher.unsubscribe("user-lists-" + userId);
        };
    }, [userId, listId, token, currentList]);

    // Update sharedWithUsers when list changes
    useEffect(() => {
        if (currentList?.acf?.shared_with_users) {
            setSharedWithUsers(currentList.acf.shared_with_users);
        }
    }, [currentList?.acf?.shared_with_users]);

    const [listTitle, setListTitle] = useState(currentList.title);
    useRealtimeRename(userId, setListTitle, isInInnerList);
    useRealtimeListDelete(listId, userId, showNotification);

    return (
        <main>
            <Header isRegistered={isRegistered} userName={userName} />

            <div className="relatve px-4">
                <ShoppingListHeader
                    ownerName={ownerName}
                    setProgress={setProgress}
                    totalProductCount={totalProductCount}
                    setAllLinkedProducts={setAllLinkedProducts}
                    setCheckedProducts={setCheckedProducts}
                    setBaggedProducts={setBaggedProducts}
                    progress={progress}
                    setTotalProductCount={setTotalProductCount}
                    setBaggedProductCount={setBaggedProductCount}
                    setShareDialogOpen={setShareDialogOpen}
                    token={token}
                    userId={userId}
                    list={currentList}
                    title={listTitle}
                    handleSearchProducts={handleSearchProducts}
                    checkedProducts={checkedProducts}
                    baggedProducts={baggedProducts}
                    allLinkedProducts={allLinkedProducts}
                />

                <div className="flex flex-col gap-4 w-full max-w-[740px] z-10 relative mx-auto mt-4 px-4 mb-32">
                    <div className="flex items-center justify-between sticky top-24 bg-[#f8f8ff] dark:bg-[#0a0a0a] z-20 px-4 pt-4 pb-2">
                        {checkedProducts && checkedProducts?.length !== 0 && (
                            <>
                                <div className="bg-[#ededed] dark:bg-[#0a0a0a] h-10 blur-lg z-10 w-full  absolute -bottom-2.5  left-0"></div>
                                <h3
                                    onClick={handleOpenChecklistSettings}
                                    className="flex cursor-pointer relative z-20  gap-1 checklist-settings"
                                >
                                    <SettingsIcon
                                        className={`w-7 h-7  ${
                                            checklistSettings
                                                ? "text-primary"
                                                : "text-gray-500 hover:text-gray-700"
                                        } transition-colors duration-200 `}
                                    />
                                    <div className="">
                                        <span className="text-2xl font-bold">
                                            Checklist{" "}
                                        </span>
                                        <span className="text-sm text-primary font-quicksand ml-2">
                                            {checkedProducts?.length} products
                                        </span>
                                    </div>

                                    {checklistSettings && (
                                        <>
                                            <div
                                                ref={checkedListSettings}
                                                className="absolute left-7 -top-2 mt-1  text-xs whitespace-nowrap py-1.5 px-1 shadow-[#00000055] rounded-sm bg-gray-200 dark:bg-gray-700 shadow-md z-30"
                                            >
                                                <div className="flex font-quicksand font-[500] flex-col gap-0.5">
                                                    <button
                                                        onClick={() =>
                                                            handleBagAllItems(
                                                                listId
                                                            )
                                                        }
                                                        className="px-1 py-1 items-center flex hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm"
                                                    >
                                                        <BagIcon className="w-5 h-5 inline-block mr-1 text-neutral-900" />
                                                        Bag All Items
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleRemoveCheckedItems(
                                                                listId
                                                            );
                                                        }}
                                                        className="px-1 py-1 cursor-pointer items-center flex hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors text-red-600 rounded-sm"
                                                    >
                                                        <XBagIcon className="w-5 h-5 inline-block mr-1 text-red-700" />
                                                        Remove All Items
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </h3>
                            </>
                        )}
                    </div>
                    <div className="checked-products-container flex flex-col gap-4">
                        {checkedProducts?.length === 0 &&
                        baggedProducts?.length === 0 ? (
                            <div className="w-full font-quicksand mt-28 flex items-center justify-center text-gray-900/60 dark:text-gray-400/60 text-lg md:text-2xl font-normal relative z-30 pointer-events-auto">
                                {isSearching ? (
                                    "No results found"
                                ) : (
                                    <div className="inline text-center">
                                        Click
                                        <button
                                            id="empty-list-add-btn"
                                            type="button"
                                            onClick={() =>
                                                setProductOverlay(true)
                                            }
                                            className="text-primary hover:text-primary/70 font-bold dark:text-primary/70  dark:hover:text-primary cursor-pointer duration-200 transition-colors ease inline px-1"
                                        >
                                            Add Products
                                        </button>
                                        to start building your list
                                    </div>
                                )}
                            </div>
                        ) : (
                            checkedProducts?.map((product, index) =>
                                product === 0 ? null : (
                                    <Product
                                        setAllLinkedProducts={
                                            setAllLinkedProducts
                                        }
                                        setBaggedProductCount={
                                            setBaggedProductCount
                                        }
                                        setTotalProductCount={
                                            setTotalProductCount
                                        }
                                        totalProductCount={totalProductCount}
                                        baggedProductCount={baggedProductCount}
                                        setProgress={setProgress}
                                        setCheckedProducts={setCheckedProducts}
                                        isBagged={false}
                                        setBaggedProducts={setBaggedProducts}
                                        token={token}
                                        product={product}
                                        key={index}
                                    />
                                )
                            )
                        )}
                    </div>

                    <div
                        className={`flex items-center justify-between sticky top-24 ${
                            checkedProducts?.length !== 0
                                ? "bg-[#f8f8ff] dark:bg-[#0a0a0a]"
                                : "bg-transparent"
                        }
                            z-20 px-4 pt-4 pb-2 
                         ${checkedProducts?.length !== 0 ? "mt-10" : "-mt-16"}
                             py-2 z-20 px-4 
                         `}
                    >
                        {baggedProducts && baggedProducts?.length !== 0 && (
                            <>
                                <div className="bg-[#ededed] dark:bg-[#0a0a0a] h-10 blur-lg z-10 w-full  absolute -bottom-2.5  left-0"></div>
                                <h3
                                    onClick={handleOpenBaggedSettings}
                                    className={`flex cursor-pointer relative z-20  gap-1 bagged-settings`}
                                >
                                    <SettingsIcon
                                        className={`w-7 h-7   ${
                                            baggedSettings
                                                ? "text-primary"
                                                : "text-gray-500 hover:text-gray-700"
                                        }  transition-colors duration-200 `}
                                    />
                                    <div>
                                        <span className="text-2xl font-bold">
                                            Bagged
                                        </span>
                                        <span className="text-sm text-primary font-quicksand ml-2">
                                            {baggedProducts?.length !== 0
                                                ? baggedProducts?.length
                                                : baggedItems.baggedCount !==
                                                      0 &&
                                                  baggedItems.baggedCount}{" "}
                                            products
                                        </span>
                                    </div>

                                    {baggedSettings && (
                                        <>
                                            <div
                                                ref={baggedListSettings}
                                                className="absolute left-7 -top-2 mt-1  text-xs whitespace-nowrap py-1.5 px-1 shadow-[#00000055] rounded-sm bg-gray-200 dark:bg-gray-700 shadow-md z-30"
                                            >
                                                <div className="flex flex-col font-quicksand font-[500] gap-0.5">
                                                    <button
                                                        onClick={() => {
                                                            handleUnbagAllProducts(
                                                                listId
                                                            );
                                                        }}
                                                        className="px-1 py-1 items-center flex hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm"
                                                    >
                                                        <EmptyBagIcon className="w-5 h-5 inline-block mr-1 text-neutral-900" />
                                                        Unbag All Items
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleRemoveBaggedItems(
                                                                listId
                                                            );
                                                        }}
                                                        className="px-1 py-1 cursor-pointer items-center flex hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors text-red-600 rounded-sm"
                                                    >
                                                        <XBagIcon className="w-5 h-5 inline-block mr-1 text-red-700" />
                                                        Remove All Items
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </h3>
                            </>
                        )}
                    </div>

                    <div className="bagged-products-container flex flex-col gap-4">
                        {baggedProducts?.map((product, index) =>
                            product === 0 ? null : (
                                <Product
                                    setAllLinkedProducts={setAllLinkedProducts}
                                    setBaggedProductCount={
                                        setBaggedProductCount
                                    }
                                    setTotalProductCount={setTotalProductCount}
                                    totalProductCount={totalProductCount}
                                    baggedProductCount={baggedProductCount}
                                    setProgress={setProgress}
                                    setCheckedProducts={setCheckedProducts}
                                    setBaggedProducts={setBaggedProducts}
                                    isBagged={true}
                                    token={token}
                                    product={product}
                                    key={index}
                                />
                            )
                        )}
                    </div>
                </div>
            </div>

            {productOverlay && (
                <AddProduct
                    favourites={favourites}
                    customProducts={customProducts}
                    setCustomProducts={setCustomProducts}
                    baggedProducts={baggedProducts}
                    progress={progress}
                    setProgress={setProgress}
                    baggedProductCount={baggedProductCount}
                    setBaggedProductCount={setBaggedProductCount}
                    totalProductCount={totalProductCount}
                    setTotalProductCount={setTotalProductCount}
                    allLinkedProducts={allLinkedProducts}
                    setAllLinkedProducts={setAllLinkedProducts}
                    setBaggedProducts={setBaggedProducts}
                    allProducts={allProducts}
                    setCheckedProducts={setCheckedProducts}
                    token={token}
                    setProductOverlay={setProductOverlay}
                    categories={categories}
                />
            )}

            <Notification />

            <div className="open-product-overlay opacity-0 fixed bottom-8 left-[50%] translate-x-[-50%] z-50">
                <Button
                    cta="Add Products"
                    color="#21ba9c"
                    hover="inwards"
                    action="add-product-overlay"
                    textColorOverride={"text-white"}
                    overrideDefaultClasses={
                        "bg-blue-800 text-black text-sm md:text-base"
                    }
                    setProductOverlay={setProductOverlay}
                />
            </div>

            <div className="w-full fixed -bottom-10 left-0  blur-xl z-40 dark:bg-black bg-[#ededed] py-14  px-4 flex items-center justify-between"></div>

            {shareDialogOpen && (
                <ShareListDialog
                    listId={shareDialogOpen}
                    onClose={() => setShareDialogOpen(null)}
                    setSharedWithUsers={setSharedWithUsers}
                    userId={userId}
                    list={currentList}
                    token={token}
                    sharedWithUsers={currentList?.acf?.shared_with_users}
                />
            )}
        </main>
    );
}
