"use client";
import gsap from "gsap";
import {animateProductExit} from "../../lib/productMotion";
import {useEffect, useState, useRef} from "react";
import {useLoading} from "../../contexts/LoadingContext";
import {calculateProgress, WP_API_BASE, decryptToken, getAllProducts, getAllCustomProducts, getFavourites, decodeHtmlEntities} from "../../lib/helpers";
import {searchProductsInLanguage} from "../../lib/domTranslations.mjs";
import useDomTranslations from "../../lib/useDomTranslations";
import {invalidateCurrentLists, seedCache, cacheVersion, cacheKeys, CACHE_TTL} from "../../lib/dataCache.mjs";
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
import {subscribePusherEvent} from "../../lib/pusherClient";

// Components
import Header from "../../components/Header";
import Notification from "../../components/Notification";
import Button from "../../components/Button";
import AddProduct from "../../components/modals/AddProduct";
import ShoppingListHeader from "../../components/parts/ShoppingListHeader";
import Product from "../../components/parts/Product";
import ShareListDialog from "../../components/modals/ShareListDialog";
import ChatWidget from "../../components/ChatWidget";
import SiteCredit from "../../components/SiteCredit";

// Icons
import SettingsIcon from "../../components/svgs/SettingsIcon";
import BagIcon from "../../components/svgs/BagIcon";
import XBagIcon from "../../components/svgs/XBagIcon";
import EmptyBagIcon from "../../components/svgs/EmptyBagIcon";

const FUSE_CHECKED_OPTIONS = {threshold: 0.4, distance: 100};

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
    // const {stopLoading} = useLoading();
    const [productOverlay, setProductOverlay] = useState(false);
    const {language, text, revision} = useDomTranslations();
    const searchTermRef = useRef("");
    const [currentList, setCurrentList] = useState(initialList);
    const currentListRef = useRef(currentList);
    currentListRef.current = currentList;

    // general products
    const [allLinkedProducts, setAllLinkedProducts] = useState(
        currentList?.acf?.linked_products,
    );
    const [checkedProducts, setCheckedProducts] = useState(checkedProductList);
    const [baggedProducts, setBaggedProducts] = useState(
        baggedItems.baggedProducts,
    );

    // custom products
    const [customProducts, setCustomProducts] = useState(userCustomProducts || []);

    // Store original product lists for search functionality
    const [originalCheckedProducts, setOriginalCheckedProducts] =
        useState(checkedProductList);
    const [originalBaggedProducts, setOriginalBaggedProducts] = useState(
        baggedItems.baggedProducts,
    );

    const [allProducts, setAllProducts] = useState(AllProducts);
    const [currentFavourites, setCurrentFavourites] = useState(favourites || []);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [shareDialogView, setShareDialogView] = useState("share");
    const [checklistSettings, setChecklistSettings] = useState(false);
    const [sharedWithUsers, setSharedWithUsers] = useState(
        currentList?.acf?.shared_with_users || [],
    );
    const [baggedSettings, setBaggedSettings] = useState(false);

    const [totalProductCount, setTotalProductCount] = useState(
        Number(currentList?.acf?.product_count) || 0,
    );
    const [baggedProductCount, setBaggedProductCount] = useState(
        Number(currentList?.acf?.bagged_product_count) || 0,
    );
    const [progress, setProgress] = useState(
        calculateProgress(totalProductCount, baggedProductCount) || 0,
    );
    const {setIsInnerList, isInInnerList, setUserLists, setListPreview} = useListContext();

    useEffect(() => {
        if (Array.isArray(AllProducts) && AllProducts.length > 0) seedCache(cacheKeys.catalogue, AllProducts, CACHE_TTL.catalogue);
        if (userId && Array.isArray(userCustomProducts)) seedCache(cacheKeys.customProducts(userId), userCustomProducts, CACHE_TTL.customProducts);
        if (userId && favourites) seedCache(cacheKeys.favourites(userId), favourites, CACHE_TTL.favourites);
    }, [AllProducts, userCustomProducts, favourites, userId]);

    // Refresh catalogue and personal product choices when the picker opens.
    // Warm entries resolve immediately; expired entries fetch without blocking the modal.
    useEffect(() => {
        if (!productOverlay || !token) return;
        let active = true;
        const customKey = userId && cacheKeys.customProducts(userId);
        const favouriteKey = userId && cacheKeys.favourites(userId);
        const customVersion = customKey && cacheVersion(customKey);
        const favouriteVersion = favouriteKey && cacheVersion(favouriteKey);
        Promise.allSettled([
            getAllProducts(token, {strict: true}),
            getAllCustomProducts(token),
            getFavourites(token),
        ]).then(([catalogue, custom, saved]) => {
            if (!active) return;
            if (catalogue.status === "fulfilled") setAllProducts(catalogue.value);
            if (custom.status === "fulfilled" && (!customKey || cacheVersion(customKey) === customVersion)) setCustomProducts(custom.value);
            if (saved.status === "fulfilled" && (!favouriteKey || cacheVersion(favouriteKey) === favouriteVersion)) setCurrentFavourites(saved.value);
        });
        return () => { active = false; };
    }, [productOverlay, token, userId]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        checklistSettings,
        baggedSettings,
        setChecklistSettings,
        setBaggedSettings,
    ]);

    const {showNotification} = useNotificationContext();

    // Update original product lists when primary lists change (outside of search)
    useEffect(() => {
        if (checkedProducts && !isSearching) {
            setOriginalCheckedProducts([...checkedProducts]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkedProducts]);

    useEffect(() => {
        if (baggedProducts && !isSearching) {
            setOriginalBaggedProducts([...baggedProducts]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baggedProducts]);

    // Track if we're currently searching
    const [isSearching, setIsSearching] = useState(false);

    // The visible list state is the source of truth for this count. Server
    // summaries and realtime events can arrive after an optimistic move.
    // Search temporarily filters rows, so keep the full count while searching.
    useEffect(() => {
        if (!isSearching) setBaggedProductCount(baggedProducts?.length || 0);
    }, [baggedProducts, isSearching]);

    // Suppress realtime toasts while AI bulk-adding
    const suppressAiToastsRef = useRef(false);
    useEffect(() => {
        const start = () => {
            suppressAiToastsRef.current = true;
        };
        const end = () => {
            // Small delay to let final state settle
            setTimeout(() => (suppressAiToastsRef.current = false), 300);
        };
        if (typeof window !== "undefined") {
            window.addEventListener("lista:ai-adding-start", start);
            window.addEventListener("lista:ai-adding-end", end);
        }
        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener("lista:ai-adding-start", start);
                window.removeEventListener("lista:ai-adding-end", end);
            }
        };
    }, []);

    // Optimistic items added from ChatWidget
    useEffect(() => {
        const handleItemsAdded = (e) => {
            const detail = e?.detail;
            if (!detail) return;
            const {listId: evtListId, items} = detail;
            if (
                parseInt(evtListId) !== parseInt(listId) ||
                !Array.isArray(items)
            )
                return;
            invalidateCurrentLists();

            // Add to checkedProducts and allLinkedProducts if not present
            setCheckedProducts((prev) => {
                const existingIds = new Set(prev?.map((p) => p.id));
                const toAdd = items.filter((it) => !existingIds.has(it.id));
                return [...(prev || []), ...toAdd];
            });

            setAllLinkedProducts((prev) => {
                const existingIds = new Set(prev?.map((p) => p.ID));
                const toAdd = items
                    .filter((it) => !existingIds.has(it.id))
                    .map((it) => ({ID: it.id, title: it.title}));
                return [...(prev || []), ...toAdd];
            });

            setTotalProductCount((prev) => prev + items.length);
        };

        if (typeof window !== "undefined") {
            window.addEventListener("lista:items-added", handleItemsAdded);
        }
        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener(
                    "lista:items-added",
                    handleItemsAdded,
                );
            }
        };
    }, [listId, showNotification]);

    // Handle search functionality with fuzzy matching
    const handleSearchProducts = (searchTerm) => {
        searchTermRef.current = searchTerm;
        if (searchTerm === "") {
            // If search is cleared, restore original lists
            setCheckedProducts([...originalCheckedProducts]);
            setBaggedProducts([...originalBaggedProducts]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        // Use Fuse.js to perform fuzzy search on both lists
        const filteredCheckedProducts = searchProductsInLanguage(originalCheckedProducts, searchTerm, language, FUSE_CHECKED_OPTIONS);
        const filteredBaggedProducts = searchProductsInLanguage(originalBaggedProducts, searchTerm, language, FUSE_CHECKED_OPTIONS);

        // Update the state with filtered results
        setCheckedProducts(filteredCheckedProducts);
        setBaggedProducts(filteredBaggedProducts);
    };

    useEffect(() => {
        const query = searchTermRef.current;
        if (!query) return;
        setCheckedProducts(searchProductsInLanguage(originalCheckedProducts, query, language, FUSE_CHECKED_OPTIONS));
        setBaggedProducts(searchProductsInLanguage(originalBaggedProducts, query, language, FUSE_CHECKED_OPTIONS));
    }, [language, revision, originalCheckedProducts, originalBaggedProducts]);

    const handleOpenChecklistSettings = () => {
        if (checklistSettings) {
            const el = document.querySelector("#checklist-settings-menu");
            if (el) {
                gsap.killTweensOf(el);
                gsap.to(el, {
                    opacity: 0,
                    y: -6,
                    scaleY: 0.96,
                    transformOrigin: "top left",
                    duration: 0.25,
                    ease: "power2.in",
                    onComplete: () => setChecklistSettings(false),
                });
                return;
            }
        }
        setChecklistSettings((prev) => !prev);
    };

    const handleOpenBaggedSettings = () => {
        if (baggedSettings) {
            const el = document.querySelector("#bagged-settings-menu");
            if (el) {
                gsap.killTweensOf(el);
                gsap.to(el, {
                    opacity: 0,
                    y: -6,
                    scaleY: 0.96,
                    transformOrigin: "top left",
                    duration: 0.25,
                    ease: "power2.in",
                    onComplete: () => setBaggedSettings(false),
                });
                return;
            }
        }
        setBaggedSettings((prev) => !prev);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            const target = event.target;
            const insideChecklistToggle = !!target.closest(
                ".checklist-settings",
            );
            const insideBaggedToggle = !!target.closest(".bagged-settings");
            const insideChecklistMenu = checklistSettings
                ? !!target.closest("#checklist-settings-menu")
                : false;
            const insideBaggedMenu = baggedSettings
                ? !!target.closest("#bagged-settings-menu")
                : false;

            if (
                !insideChecklistToggle &&
                !insideChecklistMenu &&
                checklistSettings
            ) {
                const el = document.querySelector("#checklist-settings-menu");
                if (el) {
                    gsap.killTweensOf(el);
                    gsap.to(el, {
                        opacity: 0,
                        y: -6,
                        scaleY: 0.96,
                        transformOrigin: "top left",
                        duration: 0.25,
                        ease: "power2.in",
                        onComplete: () => setChecklistSettings(false),
                    });
                } else {
                    setChecklistSettings(false);
                }
            }
            if (!insideBaggedToggle && !insideBaggedMenu && baggedSettings) {
                const el = document.querySelector("#bagged-settings-menu");
                if (el) {
                    gsap.killTweensOf(el);
                    gsap.to(el, {
                        opacity: 0,
                        y: -6,
                        scaleY: 0.96,
                        transformOrigin: "top left",
                        duration: 0.25,
                        ease: "power2.in",
                        onComplete: () => setBaggedSettings(false),
                    });
                } else {
                    setBaggedSettings(false);
                }
            }
        };

        // close if esc is pressed
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                if (checklistSettings) {
                    const el = document.querySelector(
                        "#checklist-settings-menu",
                    );
                    if (el) {
                        gsap.killTweensOf(el);
                        gsap.to(el, {
                            opacity: 0,
                            y: -6,
                            scaleY: 0.96,
                            transformOrigin: "top left",
                            duration: 0.25,
                            ease: "power2.in",
                            onComplete: () => setChecklistSettings(false),
                        });
                    } else {
                        setChecklistSettings(false);
                    }
                }
                if (baggedSettings) {
                    const el = document.querySelector("#bagged-settings-menu");
                    if (el) {
                        gsap.killTweensOf(el);
                        gsap.to(el, {
                            opacity: 0,
                            y: -6,
                            scaleY: 0.96,
                            transformOrigin: "top left",
                            duration: 0.25,
                            ease: "power2.in",
                            onComplete: () => setBaggedSettings(false),
                        });
                    } else {
                        setBaggedSettings(false);
                    }
                }
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("click", handleClickOutside);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("click", handleClickOutside);
        };
    }, [checklistSettings, baggedSettings]);

    // Animate open for checklist menu (transform + opacity for smoother perf)
    useEffect(() => {
        if (!checklistSettings) return;
        const el = document.querySelector("#checklist-settings-menu");
        if (!el) return;
        gsap.killTweensOf(el);
        gsap.set(el, {
            opacity: 0,
            y: -6,
            scaleY: 0.96,
            transformOrigin: "top right",
        });
        gsap.to(el, {
            opacity: 1,
            y: 0,
            scaleY: 1,
            duration: 0.35,
            ease: "power2.out",
        });
    }, [checklistSettings]);

    // Animate open for bagged menu (transform + opacity for smoother perf)
    useEffect(() => {
        if (!baggedSettings) return;
        const el = document.querySelector("#bagged-settings-menu");
        if (!el) return;
        gsap.killTweensOf(el);
        gsap.set(el, {
            opacity: 0,
            y: -6,
            scaleY: 0.96,
            transformOrigin: "top right",
        });
        gsap.to(el, {
            opacity: 1,
            y: 0,
            scaleY: 1,
            duration: 0.35,
            ease: "power2.out",
        });
    }, [baggedSettings]);

    // Update progress when baggedProductCount or totalProductCount changes
    useEffect(() => {
        if (totalProductCount === 0) setProgress(0);
        if (baggedProductCount === 0) setProgress(0);
        const newProgress = calculateProgress(
            totalProductCount,
            baggedProductCount,
        );
        setProgress(newProgress);
    }, [
        totalProductCount,
        baggedProductCount,
        checkedProducts,
        baggedProducts,
    ]);

    const bulkActionInFlightRef = useRef(false);
    const animateBulkRowsOut = (selector, direction) =>
        animateProductExit(document.querySelector(selector)?.querySelectorAll(".list-product-row"), direction);

    // Bag All Products
    const handleBagAllItems = async (listId) => {
        if (bulkActionInFlightRef.current || checkedProducts.length === 0) return;
        invalidateCurrentLists();
        bulkActionInFlightRef.current = true;
        await animateBulkRowsOut(".checked-products-container", 1);
        updateStates();
        bulkActionInFlightRef.current = false;
        showNotification("Products Bagged", "success", 1000);

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
                    },
                );
                if (res.ok) invalidateCurrentLists();
            } catch (error) {
                console.error("Bagging error:", error);
                // Revert state on error
                setBaggedProducts((prev) =>
                    prev.filter(
                        (p) => !checkedProducts.some((cp) => cp.id === p.id),
                    ),
                );
                setCheckedProducts((prev) => [...prev, ...checkedProducts]);
                setBaggedProductCount((prev) => prev - checkedProducts.length);
            }
        }
    };

    const handleUnbagAllProducts = async (listId) => {
        if (bulkActionInFlightRef.current || baggedProducts.length === 0) return;
        invalidateCurrentLists();
        bulkActionInFlightRef.current = true;
        await animateBulkRowsOut(".bagged-products-container", -1);
        updateStates();
        bulkActionInFlightRef.current = false;
        showNotification("Products Unbagged", "success", 1000);

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
                    },
                );
                if (res.ok) invalidateCurrentLists();
            } catch (error) {
                console.error("Unbagging error:", error);
                // Revert state on error
                setCheckedProducts((prev) =>
                    prev.filter(
                        (p) => !baggedProducts.some((bp) => bp.id === p.id),
                    ),
                );
                setBaggedProducts((prev) => [...prev, ...baggedProducts]);
                setBaggedProductCount(baggedProducts.length);
            }
        }
    };

    // REMOVE ALL CHECKED AND LINKED PRODUCTS
    const handleRemoveCheckedItems = async (listId) => {
        if (bulkActionInFlightRef.current || checkedProducts.length === 0) return;
        invalidateCurrentLists();
        bulkActionInFlightRef.current = true;
        const productsToRemove = [...checkedProducts]; // Create a copy of checked products
        await animateBulkRowsOut(".checked-products-container", 1);
        updateStates(productsToRemove);
        bulkActionInFlightRef.current = false;
        showNotification("Products Removed", "success", 1000);

        function updateStates(productsToRemove) {
            // Update state - remove all checked products
            setCheckedProducts([]);
            setTotalProductCount((prev) => prev - productsToRemove.length);
            setAllLinkedProducts((prev) =>
                prev.filter(
                    (p) => !productsToRemove.some((r) => r.id === p.ID),
                ),
            );

            // Also update original checked products if not searching
            if (!isSearching) {
                setOriginalCheckedProducts([]);
            }

            // Also remove from bagged if any were bagged
            setBaggedProducts((prev) => {
                const newBagged = prev.filter(
                    (p) => !productsToRemove.some((r) => r.id === p.id),
                );
                setBaggedProductCount(newBagged.length);
                return newBagged;
            });

            // Update original bagged products if not searching
            if (!isSearching) {
                setOriginalBaggedProducts((prev) =>
                    prev.filter(
                        (p) => !productsToRemove.some((r) => r.id === p.id),
                    ),
                );
            }

            // Send API request
            sendApiRequest(listId, productsToRemove);

            // Notify other components (e.g., ChatWidget) that list was emptied
            try {
                if (productsToRemove.length > 0) {
                    window.dispatchEvent(
                        new CustomEvent("lista:list-emptied", {
                            detail: {listId},
                        }),
                    );
                }
            } catch {}
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
                    },
                );

                const data = await res.json();
                if (res.ok) invalidateCurrentLists();
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
        if (bulkActionInFlightRef.current || baggedProducts.length === 0) return;
        invalidateCurrentLists();
        bulkActionInFlightRef.current = true;
        const productsToRemove = [...baggedProducts];
        await animateBulkRowsOut(".bagged-products-container", 1);
        updateStates(productsToRemove);
        bulkActionInFlightRef.current = false;
        showNotification("Products Removed", "success", 1000);

        function updateStates(productsToRemove) {
            // Update state - remove all bagged products
            setBaggedProducts([]);
            setBaggedProductCount(0);
            setTotalProductCount((prev) => prev - productsToRemove.length);
            setAllLinkedProducts((prev) =>
                prev.filter(
                    (p) => !productsToRemove.some((r) => r.id === p.ID),
                ),
            );

            // Update original bagged products if not searching
            if (!isSearching) {
                setOriginalBaggedProducts([]);
            }

            // Send API request
            sendApiRequest(listId, productsToRemove);

            // Notify that list content was emptied (bagged cleared)
            try {
                if (productsToRemove.length > 0) {
                    window.dispatchEvent(
                        new CustomEvent("lista:list-emptied", {
                            detail: {listId},
                        }),
                    );
                }
            } catch {}
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
                    },
                );

                const data = await res.json();
                if (res.ok) invalidateCurrentLists();
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
        invalidateCurrentLists();

        // Normalize the linked products to ensure consistent ID field
        if (Array.isArray(data.fields.linked_products)) {
            const normalizedLinkedProducts = data.fields.linked_products.map(
                (product) => ({
                    ...product,
                    id: product.ID || product.id, // Ensure both ID and id exist
                    ID: product.ID || product.id,
                }),
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
                }),
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
        if (Array.isArray(data.fields.bagged_linked_products)) {
            setBaggedProductCount(data.fields.bagged_linked_products.length);
        } else if (data.fields.bagged_product_count !== undefined) {
            setBaggedProductCount(Number(data.fields.bagged_product_count));
        }

        // Show notification unless suppressed by AI bulk add
        if (data.message && !suppressAiToastsRef.current) {
            showNotification(data.message);
        }
    });

    // Handle being removed from shared list and other share updates
    useEffect(() => {
        if (!userId) return;
        return subscribePusherEvent("user-lists-" + userId, "share-update", (data) => {
            invalidateCurrentLists();
            if (data.action === "add" && parseInt(data.listId) === parseInt(listId)) {
                const addedUser = {ID: parseInt(data.userId), display_name: data.userName};
                const addMember = (members = []) =>
                    members.some((member) => parseInt(member.ID) === addedUser.ID)
                        ? members
                        : [...members, addedUser];
                setCurrentList((previous) => ({
                    ...previous,
                    acf: {...previous.acf, shared_with_users: addMember(previous.acf?.shared_with_users)},
                }));
                setUserLists((previous) => previous.map((item) =>
                    parseInt(item.id) === parseInt(listId)
                        ? {...item, acf: {...item.acf, shared_with_users: addMember(item.acf?.shared_with_users)}}
                        : item
                ));
                return;
            }
            // If we're the one being removed
            if (
                data.action === "remove" &&
                parseInt(data.userId) === parseInt(userId) &&
                parseInt(data.listId) === parseInt(listId)
            ) {
                const suppress = (() => {
                    try {
                        return (
                            sessionStorage.getItem(
                                "suppressSelfRemovalToast",
                            ) === "1"
                        );
                    } catch {
                        return false;
                    }
                })();
                const selfRemoved =
                    suppress || parseInt(data.actorId) === parseInt(userId);
                showNotification(
                    selfRemoved
                        ? "List removed successfully"
                        : "The list owner has removed you from this list",
                    selfRemoved ? "success" : "info",
                );
                try {
                    sessionStorage.removeItem("suppressSelfRemovalToast");
                } catch {}
                // Store removal data for home page
                const removeData = {
                    listId: data.listId,
                    userId: data.userId,
                    token: token,
                };
                sessionStorage.setItem(
                    "removeListData",
                    JSON.stringify(removeData),
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
                    currentListRef.current?.acf?.shared_with_users || []
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
                            : l,
                    ),
                );

                // Notify owner/shared users inside inner list
                const someoneLeft =
                    parseInt(data.actorId) === parseInt(data.userId);
                const name = data.userName || "A user";
                showNotification(
                    someoneLeft
                        ? `${name} left the list`
                        : `${name} was removed from the list`,
                    someoneLeft ? "info" : "warning",
                );
            }
        });
    }, [userId, listId, token, setUserLists, showNotification]);

    // Update sharedWithUsers when list changes
    useEffect(() => {
        if (currentList?.acf?.shared_with_users) {
            setSharedWithUsers(currentList.acf.shared_with_users);
        }
    }, [currentList?.acf?.shared_with_users]);

    const [listTitle, setListTitle] = useState(currentList.title);

    // Keep navigation previews current after adding, bagging, or removing items.
    useEffect(() => {
        const preview = {
            ...currentList,
            id: listId,
            title: listTitle,
            acf: {...currentList.acf, product_count: totalProductCount, bagged_product_count: baggedProductCount},
        };
        setListPreview(preview);
        setUserLists((previous) => previous?.map((item) =>
            String(item.id) === String(listId)
                ? {...item, title: listTitle, acf: {...item.acf, product_count: totalProductCount, bagged_product_count: baggedProductCount}}
                : item
        ));
    }, [currentList, listId, listTitle, totalProductCount, baggedProductCount, setListPreview, setUserLists]);
    useRealtimeRename(userId, listId, listTitle, setListTitle, isInInnerList);
    useRealtimeListDelete(listId, userId, showNotification);

    return (
        <main className={`list-detail-page ${checkedProducts?.length === 0 && baggedProducts?.length === 0 ? "is-empty" : ""}`}>
            <div className="list-translation-seed" aria-hidden="true">
                {["Checklist", "Bagged", "To buy", "product", "products"].map((copy) =>
                    <span key={copy} data-lista-translate-key={`list-copy:${copy}`} data-lista-source={copy}>{copy}</span>
                )}
                {[...(originalCheckedProducts || []), ...(originalBaggedProducts || [])].map((product) => {
                    const copy = decodeHtmlEntities(product.title);
                    return <span key={product.id} data-lista-translate-key={`product:${product.id}`} data-lista-source={copy}>{copy}</span>;
                })}
            </div>
            <Header isRegistered={isRegistered} userName={userName} />

            <div className="list-detail-shell">
                <ShoppingListHeader
                    ownerName={ownerName}
                    setProgress={setProgress}
                    totalProductCount={totalProductCount}
                    baggedProductCount={baggedProductCount}
                    setAllLinkedProducts={setAllLinkedProducts}
                    setCheckedProducts={setCheckedProducts}
                    setBaggedProducts={setBaggedProducts}
                    progress={progress}
                    setTotalProductCount={setTotalProductCount}
                    setBaggedProductCount={setBaggedProductCount}
                    setShareDialogOpen={setShareDialogOpen}
                    onManageAccess={() => {
                        setShareDialogView("members");
                        setShareDialogOpen(currentList.id);
                    }}
                    sharedWithUsers={sharedWithUsers}
                    token={token}
                    userId={userId}
                    list={currentList}
                    title={listTitle}
                    handleSearchProducts={handleSearchProducts}
                    checkedProducts={checkedProducts}
                    baggedProducts={baggedProducts}
                    allLinkedProducts={allLinkedProducts}
                />

                <div className="list-detail-content flex flex-col gap-4 w-full z-10 relative mx-auto">
                    {/* bg-[#f8f8ff] dark:bg-[#0a0a0a] */}
                    <div
                        className={`list-section-heading flex items-center justify-between sticky top-24 hidden-bg z-20 px-4 pt-4 pb-2 ${
                            checkedProducts?.length === 0 ? "hidden" : ""
                        }`}
                    >
                        {checkedProducts && checkedProducts?.length !== 0 && (
                            <>
                                <div className="hidden-bg h-10 blur-lg z-10 w-full  absolute -bottom-2.5  left-0"></div>
                                <h3
                                    onClick={handleOpenChecklistSettings}
                                    className="flex cursor-pointer relative z-20  gap-1 checklist-settings"
                                >
                                    <SettingsIcon
                                        className={`settings-icon w-7 h-7  ${
                                            checklistSettings
                                                ? "text-primary"
                                                : "text-gray-500 hover:text-gray-700"
                                        } transition-colors duration-200 `}
                                    />
                                    <div className="">
                                        <span className="text-2xl font-bold">
                                            <span data-lista-translate-key="list-copy:Checklist" data-lista-source="Checklist" translate={text("list-copy:Checklist", "Checklist") !== "Checklist" ? "no" : undefined}>{text("list-copy:Checklist", "Checklist")}</span>{" "}
                                        </span>
                                        <span className="text-sm brand-color transition-colors duration-200 font-quicksand ml-2">
                                            {checkedProducts?.length} {checkedProducts?.length === 1 ? text("list-copy:product", "product") : text("list-copy:products", "products")}
                                        </span>
                                    </div>

                                    {checklistSettings && (
                                        <>
                                            <div
                                                id="checklist-settings-menu"
                                                ref={checkedListSettings}
                                                className="list-detail-menu tools"
                                            >
                                                <div className="flex font-quicksand font-[500] flex-col gap-0.5">
                                                    <button
                                                        onClick={() =>
                                                            handleBagAllItems(
                                                                listId,
                                                            )
                                                        }
                                                        className="px-1 py-1 items-center flex tool cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm"
                                                    >
                                                        <BagIcon className="w-5 h-5 inline-block mr-1 text-neutral-900" />
                                                        Bag All Items
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleRemoveCheckedItems(
                                                                listId,
                                                            );
                                                        }}
                                                        className="px-1 py-1 tool-danger cursor-pointer items-center flex text-left duration-200 transition-colors text-red-600 rounded-sm"
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
                    <div
                        className={`checked-products-container flex flex-col gap-4 ${
                            checkedProducts?.length === 0 &&
                            baggedProducts?.length !== 0
                                ? "hidden"
                                : ""
                        }`}
                    >
                        {checkedProducts?.length === 0 &&
                        baggedProducts?.length === 0 ? (
                            <div className="list-empty-state">
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
                                            className="brand-color font-bold hover cursor-pointer duration-200 transition-colors ease inline px-1"
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
                                        displayTitle={text(`product:${product.id}`, decodeHtmlEntities(product.title))}
                                        statusLabel={text("list-copy:To buy", "To buy")}
                                        index={index}
                                        key={product.id}
                                    />
                                ),
                            )
                        )}
                    </div>

                    <div
                        className={`list-section-heading flex items-center justify-between sticky top-24 ${
                            checkedProducts?.length !== 0 ||
                            baggedProducts?.length !== 0
                                ? "hidden-bg"
                                : "bg-transparent"
                        }
                            z-20 px-4 pt-4 pb-2 
                         ${
                             checkedProducts?.length !== 0
                                 ? "mt-10"
                                 : baggedProducts?.length !== 0
                                   ? "mt-0"
                                   : "-mt-16"
                         }
                             py-2 z-20 px-4 
                         `}
                    >
                        {baggedProducts && baggedProducts?.length !== 0 && (
                            <>
                                <div className=" hidden-bg h-10 blur-lg z-10 w-full  absolute -bottom-2.5  left-0"></div>
                                <h3
                                    onClick={handleOpenBaggedSettings}
                                    className={`flex cursor-pointer relative z-20  gap-1 bagged-settings`}
                                >
                                    <SettingsIcon
                                        className={`settings-icon w-7 h-7   ${
                                            baggedSettings
                                                ? "text-primary"
                                                : "text-gray-500 hover:text-gray-700"
                                        }  transition-colors duration-200 `}
                                    />
                                    <div>
                                        <span className="text-2xl font-bold">
                                            <span data-lista-translate-key="list-copy:Bagged" data-lista-source="Bagged" translate={text("list-copy:Bagged", "Bagged") !== "Bagged" ? "no" : undefined}>{text("list-copy:Bagged", "Bagged")}</span>
                                        </span>
                                        <span className="text-sm brand-color transition-colors duration-200 font-quicksand ml-2">
                                            {baggedProducts?.length !== 0
                                                ? baggedProducts?.length
                                                : baggedItems.baggedCount !==
                                                      0 &&
                                                  baggedItems.baggedCount}{" "}
                                            {" "}{baggedProducts?.length === 1 ? text("list-copy:product", "product") : text("list-copy:products", "products")}
                                        </span>
                                    </div>

                                    {baggedSettings && (
                                        <>
                                            <div
                                                id="bagged-settings-menu"
                                                ref={baggedListSettings}
                                                className="list-detail-menu tools"
                                            >
                                                <div className="flex flex-col font-quicksand font-[500] gap-0.5">
                                                    <button
                                                        onClick={() => {
                                                            handleUnbagAllProducts(
                                                                listId,
                                                            );
                                                        }}
                                                        className="px-1 py-1 items-center flex tool cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm"
                                                    >
                                                        <EmptyBagIcon className="w-5 h-5 inline-block mr-1 text-neutral-900" />
                                                        Unbag All Items
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleRemoveBaggedItems(
                                                                listId,
                                                            );
                                                        }}
                                                        className="px-1 py-1 cursor-pointer tool-danger items-center flex  text-left duration-200 transition-colors text-red-600 rounded-sm"
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

                    <div
                        className="bagged-products-container flex flex-col gap-4 mb-2"
                    >
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
                                    displayTitle={text(`product:${product.id}`, decodeHtmlEntities(product.title))}
                                    statusLabel={text("list-copy:Bagged", "Bagged")}
                                    index={index}
                                    key={product.id}
                                />
                            ),
                        )}
                    </div>
                </div>
            </div>

            <footer className="site-footer"><SiteCredit /></footer>

            {productOverlay && (
                <AddProduct
                    favourites={currentFavourites}
                    customProducts={customProducts}
                    setCustomProducts={setCustomProducts}
                    baggedProducts={baggedProducts}
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

            <ChatWidget context="list" listId={listId} token={token} />

            <div className="open-product-overlay opacity-0 fixed bottom-6 left-[50%] translate-x-[-50%] z-50">
                <Button
                    cta="Add Products"
                    action="add-product-overlay"
                    textColorOverride={"text-white"}
                    overrideDefaultClasses="app-primary-action"
                    setProductOverlay={setProductOverlay}
                />
            </div>

            <div className="w-full fixed -bottom-10 left-0  blur-xl z-40 hidden-bg py-14  px-4 flex items-center justify-between"></div>

            {shareDialogOpen && (
                <ShareListDialog
                    listId={shareDialogOpen}
                    onClose={() => {
                        setShareDialogOpen(null);
                        setShareDialogView("share");
                    }}
                    setSharedWithUsers={(users) => {
                        setSharedWithUsers(users);
                        setCurrentList((previous) => ({
                            ...previous,
                            acf: {...previous.acf, shared_with_users: users},
                        }));
                    }}
                    userId={userId}
                    list={currentList}
                    token={token}
                    sharedWithUsers={sharedWithUsers}
                    initialView={shareDialogView}
                />
            )}
        </main>
    );
}
