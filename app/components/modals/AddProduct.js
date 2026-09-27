"use client";
import gsap from "gsap";
import {useCallback, useEffect, useRef, useState, useMemo} from "react";
import Fuse from "fuse.js";
import {createSmoothScroller} from "../../lib/smoothScroll";
import {useListContext} from "../../contexts/ListContext";
import {Check, Flame, Grid2X2, Heart, Plus, Search, Star, Trash2, X} from "lucide-react";
import {
    decryptToken,
    WP_API_BASE,
    getAllCustomProducts,
    decodeHtmlEntities,
} from "../../lib/helpers";

import {INGREDIENT_NAME_MAX_LENGTH} from "../../lib/config";
import {invalidateCurrentLists, invalidateCurrentProducts} from "../../lib/dataCache.mjs";
import "../../css/product-picker.css";
import {useParams} from "next/navigation";
import CategoryFilter from "../CategoryFilter";

// WordPress updates the whole list for each request. Keep writes in order,
// while the picker can respond to every click immediately.
const listMutationQueues = new Map();
function enqueueListMutation(listId, mutation) {
    const key = String(listId);
    const previous = listMutationQueues.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(mutation);
    listMutationQueues.set(key, next);
    next.finally(() => {
        if (listMutationQueues.get(key) === next) listMutationQueues.delete(key);
    }).catch(() => {});
}

// Contexts
import {useNotificationContext} from "../../contexts/NotificationContext";

export default function AddProduct({
    favourites,
    totalProductCount,
    setTotalProductCount,
    baggedProductCount,
    setBaggedProductCount,
    setProgress,
    allLinkedProducts,
    setAllLinkedProducts,
    setProductOverlay,
    token,
    setCheckedProducts,
    allProducts,
    baggedProducts,
    setBaggedProducts,
    customProducts,
    setCustomProducts,
    categories,
}) {
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState(allProducts);
    const [favouriteProducts, setFavouriteProducts] = useState(favourites);
    const favouritesEditedRef = useRef(false);
    useEffect(() => {
        if (!favouritesEditedRef.current) setFavouriteProducts(favourites);
    }, [favourites]);
    const [searchResults, setSearchResults] = useState(null);
    const [popularSearchResults, setPopularSearchResults] = useState(null);
    const [favouriteSearchResults, setFavouriteSearchResults] = useState(null);
    const customProductInputRef = useRef(null);
    const [customProductLength, setCustomProductLength] = useState(0);
    const maxLength = INGREDIENT_NAME_MAX_LENGTH;

    const {showNotification} = useNotificationContext();

    const productListRef = useRef();
    const productScrollerRef = useRef(null);
    const {lenis} = useListContext();
    const shoppingListId = useParams().id;

    const [selectedProductsSection, setSelectedProductsSection] =
        useState("popular");
    const overlayRef = useRef(null);
    const panelRef = useRef(null);
    const selectedIdsRef = useRef(new Set((allLinkedProducts || []).map((item) => String(item.ID))));
    const baggedIdsRef = useRef(new Set((baggedProducts || []).map((item) => String(item.id))));
    const removedBaggedRef = useRef(new Map());
    const countsRef = useRef({total: totalProductCount, bagged: baggedProductCount});
    const pendingCountRef = useRef(0);
    const intentVersionRef = useRef(new Map());
    const failureNotifiedRef = useRef(false);

    useEffect(() => {
        if (pendingCountRef.current !== 0) return;
        selectedIdsRef.current = new Set((allLinkedProducts || []).map((item) => String(item.ID)));
        baggedIdsRef.current = new Set((baggedProducts || []).map((item) => String(item.id)));
        countsRef.current = {total: totalProductCount, bagged: baggedProductCount};
    }, [allLinkedProducts, baggedProducts, totalProductCount, baggedProductCount]);

    const fuseOptions = {
        keys: ["title"],
        threshold: 0.3,
        distance: 100,
    };

    const applySelection = (productId, selected, {restoreBagged = false} = {}) => {
        const key = String(productId);
        const wasSelected = selectedIdsRef.current.has(key);
        if (wasSelected === selected) return;
        const wasBagged = baggedIdsRef.current.has(key);
        const baggedRecord = removedBaggedRef.current.get(key);
        const title = allProducts.find((item) => String(item.id) === key)?.title
            || customProducts.find((item) => String(item.id) === key)?.title
            || allLinkedProducts?.find((item) => String(item.ID) === key)?.title
            || baggedRecord?.title;

        if (selected) {
            selectedIdsRef.current.add(key);
            setAllLinkedProducts((previous) => [
                ...(previous || []).filter((item) => String(item.ID) !== key),
                {ID: productId, title},
            ]);
            if (restoreBagged && baggedRecord) {
                baggedIdsRef.current.add(key);
                setBaggedProducts((previous) => [
                    ...(previous || []).filter((item) => String(item.id) !== key),
                    baggedRecord,
                ]);
                countsRef.current.bagged += 1;
            } else {
                setCheckedProducts((previous) => [
                    ...(previous || []).filter((item) => String(item.id) !== key),
                    {id: productId, title},
                ]);
            }
        } else {
            selectedIdsRef.current.delete(key);
            if (wasBagged) {
                const record = baggedProducts?.find((item) => String(item.id) === key);
                if (record) removedBaggedRef.current.set(key, record);
                baggedIdsRef.current.delete(key);
                countsRef.current.bagged -= 1;
            }
            setCheckedProducts((previous) => (previous || []).filter((item) => String(item.id) !== key));
            setBaggedProducts((previous) => (previous || []).filter((item) => String(item.id) !== key));
            setAllLinkedProducts((previous) => (previous || []).filter((item) => String(item.ID) !== key));
        }
        countsRef.current.total += selected ? 1 : -1;
        setTotalProductCount(countsRef.current.total);
        setBaggedProductCount(countsRef.current.bagged);
        setProgress(countsRef.current.total > 0
            ? Math.round((countsRef.current.bagged / countsRef.current.total) * 100)
            : 0);
    };

    const handleCheckboxChange = (productId) => {
        if (!shoppingListId || !token) return;
        const key = String(productId);
        const wasSelected = selectedIdsRef.current.has(key);
        const wasBagged = baggedIdsRef.current.has(key);
        const shouldSelect = !wasSelected;
        const version = (intentVersionRef.current.get(key) || 0) + 1;
        intentVersionRef.current.set(key, version);
        pendingCountRef.current += 1;
        applySelection(productId, shouldSelect);
        invalidateCurrentLists();

        enqueueListMutation(shoppingListId, async () => {
            try {
                const response = await fetch(`${WP_API_BASE}/custom/v1/update-shopping-list`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${decryptToken(token)}`,
                    },
                    body: JSON.stringify({
                        shoppingListId,
                        productId,
                        action: shouldSelect ? "add" : "remove",
                    }),
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (data?.error) throw new Error(data.error);
                failureNotifiedRef.current = false;
                invalidateCurrentLists();
            } catch {
                if (intentVersionRef.current.get(key) === version) {
                    applySelection(productId, wasSelected, {restoreBagged: wasBagged});
                }
                if (!failureNotifiedRef.current) {
                    showNotification("Couldn’t update the list. Please check your connection and try again.", "error");
                    failureNotifiedRef.current = true;
                }
            } finally {
                pendingCountRef.current -= 1;
            }
        });
    };

    // Slide-up + fade for the full-screen AddProduct modal
    useEffect(() => {
        const overlay = overlayRef.current;
        const panel = panelRef.current;
        if (!overlay || !panel) return;
        const prefersReduced =
            typeof window !== "undefined" &&
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        gsap.killTweensOf([overlay, panel]);
        gsap.set(overlay, {opacity: 0});
        gsap.set(panel, {
            y: 24,
            opacity: 0,
            scale: 0.98,
            willChange: "transform,opacity",
        });
        gsap.timeline()
            .to(
                overlay,
                {
                    opacity: 1,
                    duration: prefersReduced ? 0 : 0.5,
                    ease: "power1.out",
                },
                0
            )
            .to(
                panel,
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: prefersReduced ? 0 : 1,
                    ease: "power2.out",
                },
                0
            );
    }, []);

    const closeOverlay = useCallback(() => {
        const overlay = overlayRef.current;
        const panel = panelRef.current;
        if (!overlay || !panel) {
            setProductOverlay(false);
            return;
        }
        const prefersReduced =
            typeof window !== "undefined" &&
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        gsap.killTweensOf([overlay, panel]);
        gsap.timeline({
            onComplete: () => {
                setProductOverlay(false);
            },
        })
            .to(
                panel,
                {
                    y: 12,
                    opacity: 0,
                    scale: 0.99,
                    duration: prefersReduced ? 0 : 0.25,
                    ease: "power2.in",
                },
                0
            )
            .to(
                overlay,
                {
                    opacity: 0,
                    duration: prefersReduced ? 0 : 0.25,
                    ease: "power1.in",
                },
                0.05
            );
    }, [setProductOverlay]);

    // Search functionality with fuzzy search
    const [searchValue, setSearchValue] = useState("");

    const handleSearchProduct = (e) => {
        const value = e.target.value;
        setSearchValue(value);

        if (value === "") {
            setPopularSearchResults(null);
            setSearchResults(null);
            setFavouriteSearchResults(null);
        } else {
            // Search in popular products
            const popularFuse = new Fuse(allProducts, fuseOptions);
            const popularResults = popularFuse.search(value);
            setPopularSearchResults(
                popularResults.map((result) => result.item)
            );

            // Search in custom products
            const customFuse = new Fuse(customProducts, fuseOptions);
            const customResults = customFuse.search(value);
            setSearchResults(customResults.map((result) => result.item));

            // Search in favourite products
            const favouriteFuse = new Fuse(favouriteProducts, fuseOptions);
            const favouriteResults = favouriteFuse.search(value);
            setFavouriteSearchResults(
                favouriteResults.map((result) => result.item)
            );
        }
    };

    // Get the correct products to display based on the selected section
    const displayedProducts = useMemo(() => {
        if (selectedProductsSection === "popular") {
            return popularSearchResults || allProducts;
        } else if (selectedProductsSection === "custom") {
            return searchResults || customProducts;
        } else if (selectedProductsSection === "favourite") {
            return favouriteSearchResults || favouriteProducts;
        }
        return [];
    }, [
        selectedProductsSection,
        popularSearchResults,
        searchResults,
        favouriteSearchResults,
        allProducts,
        customProducts,
        favouriteProducts,
    ]);

    // Animate search results with simple fade-in (immediate, only on search input changes)
    useEffect(() => {
        if (!searchValue?.trim()) return; // only when searching
        if (!productListRef.current) return;

        const productItems = productListRef.current.querySelectorAll(
            ".product-list-content .product-card"
        );
        gsap.fromTo(
            productItems,
            {opacity: 0},
            {
                opacity: 1,
                duration: 0.3,
                ease: "power2.out",
            }
        );
    }, [searchValue]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                closeOverlay();
            }
        };
        const handleOutsideClick = (event) => {
            if (event.target.classList.contains("close-product-overlay")) {
                closeOverlay();
            }
        };

        window.addEventListener("click", handleOutsideClick);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("click", handleOutsideClick);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [closeOverlay]);

    useEffect(() => {
        const pageScroller = lenis.current;
        pageScroller?.stop();
        const scroller = createSmoothScroller({
            wrapper: productListRef.current,
            content: productListRef.current.firstElementChild,
            overscroll: false,
        });
        productScrollerRef.current = scroller.instance;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
            scroller.destroy();
            productScrollerRef.current = null;
            pageScroller?.start();
        };
    }, [lenis]);

    // Create Custom Product
    const [error, setError] = useState(null);
    const handleCreateCustomProduct = async () => {
        if (
            !customProductInputRef.current ||
            customProductInputRef.current.value.trim() === ""
        ) {
            setError("Please enter a product name");
            setTimeout(() => {
                setError(null);
            }, 4000);
            return;
        }

        const customProductTitle = customProductInputRef.current.value.trim();
        if (customProductTitle) {
            const newCustomProduct = {
                title: customProductTitle,
            };

            // Create a temporary ID with a 'temp-' prefix to identify unsaved products
            const tempId = `temp-${Date.now()}`;
            const animatedProduct = {
                ...newCustomProduct,
                id: tempId,
                isTemporary: true, // Add a flag to identify temporary products
                isSaving: true, // Add a flag to show loading state
            };

            // Animate only the newly added item once it is rendered
            requestAnimationFrame(() => {
                if (productListRef.current) {
                    const el = productListRef.current.querySelector(
                        `.product-list-content [data-product-id='${animatedProduct.id}']`
                    );
                    if (el) {
                        gsap.fromTo(
                            el,
                            {opacity: 0, y: -20},
                            {
                                opacity: 1,
                                y: 0,
                                duration: 0.4,
                                ease: "power2.out",
                            }
                        );
                    }
                }
            });

            customProductInputRef.current.value = "";
            setCustomProductLength(0);
            // Optimistically update UI lists with the temporary product
            const updatedCustomProducts = [animatedProduct, ...customProducts];
            setCustomProducts(updatedCustomProducts);
            const nextCustom = [...updatedCustomProducts];

            // If searching, update the custom search results immediately
            if (searchValue) {
                const customFuse = new Fuse(nextCustom, fuseOptions);
                const customResults = customFuse.search(searchValue);
                setSearchResults(customResults.map((r) => r.item));
            }
        }

        const decryptedToken = decryptToken(token);
        const res = await fetch(
            `${WP_API_BASE}/custom/v1/create-custom-product`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${decryptedToken}`,
                },
                body: JSON.stringify({
                    title: customProductTitle,
                }),
            }
        );
        const data = await res.json();
        invalidateCurrentProducts();
        const fetchedCustomProducts = await getAllCustomProducts(token);
        setCustomProducts(fetchedCustomProducts);
        if (searchValue) {
            setSearchResults(
                new Fuse(fetchedCustomProducts, fuseOptions)
                    .search(searchValue)
                    .map((result) => result.item)
            );
        }
    };

    // Delete custom product
    const handleDeleteCustomProduct = async (
        productId,
        token,
        shoppingListId,
        customProductss
    ) => {
        invalidateCurrentLists();
        invalidateCurrentProducts();
        // Animate the products getting deleted
        if (productListRef.current) {
            const productDiv = productListRef.current.querySelector(
                `.product-list-content [data-product-id='${productId}']`
            );
            if (productDiv) {
                await new Promise((resolve) => {
                    gsap.to(productDiv, {
                        y: 80,
                        opacity: 0,
                        backgroundColor: "#dc2626",
                        duration: 0.5,
                        ease: "power2.in",
                        onComplete: resolve,
                    });
                });
            }
        }
        // Update the list locally
        setCustomProducts((prev) => prev.filter((p) => p.id !== productId));

        // Also remove from favourites immediately if present
        setFavouriteProducts((prev) => {
            const nextFavs = prev?.filter((p) => p.id !== productId) || [];
            // If searching, update favourite search results immediately
            if (searchValue) {
                const favFuse = new Fuse(nextFavs, fuseOptions);
                const favResults = favFuse.search(searchValue);
                setFavouriteSearchResults(favResults.map((r) => r.item));
            }
            return nextFavs;
        });

        // Delete the actual product in the server
        const decryptedToken = decryptToken(token);
        const res = await fetch(
            `${WP_API_BASE}/custom/v1/delete-custom-product`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${decryptedToken}`,
                },
                body: JSON.stringify({
                    productId: productId,
                    shoppingListId: shoppingListId,
                }),
            }
        );
        const data = await res.json();

        // if in linked products set counter minus 1
        invalidateCurrentLists();
        invalidateCurrentProducts();
        const isProductLinked = allLinkedProducts?.some(
            (product) => product.ID === productId
        );
        if (isProductLinked) {
            setTotalProductCount((prev) => prev - 1);
        }
        setAllLinkedProducts((prev) =>
            prev?.filter((product) => product.ID !== productId)
        );
        setCheckedProducts((prev) =>
            prev?.filter((product) => product.id !== productId)
        );

        // if in bagged products set counter minus 1
        const isProductBagged = baggedProducts?.some(
            (product) => product.id === productId
        );
        if (isProductBagged) {
            setBaggedProductCount((prev) => prev - 1);
        }
        setBaggedProducts((prev) =>
            prev?.filter((product) => product.id !== productId)
        );

        setProgress((prev) => {
            const newProgress = prev - (1 / totalProductCount) * 100;
            return newProgress < 0 ? 0 : newProgress;
        });
    };

    const handleAddToFavourites = async (productId, token) => {
        favouritesEditedRef.current = true;
        invalidateCurrentProducts();
        // title
        const productTitle =
            allProducts.find((product) => product.id === productId)?.title ||
            customProducts.find((product) => product.id === productId)?.title;

        // if already in favourites, remove it
        if (favouriteProducts?.some((p) => p.id === productId)) {
            setFavouriteProducts((prev) => {
                const nextFavs = prev?.filter((p) => p.id !== productId) || [];
                // keep Favourites tab results in sync when searching
                if (searchValue) {
                    const favFuse = new Fuse(nextFavs, fuseOptions);
                    const favResults = favFuse.search(searchValue);
                    setFavouriteSearchResults(favResults.map((r) => r.item));
                } else if (selectedProductsSection === "favourite") {
                    // reflect immediately in the Favourites tab even without search
                    setFavouriteSearchResults(nextFavs);
                }
                return nextFavs;
            });
            showNotification(
                `Removed ${productTitle} from favourites`,
                "success",
                1000
            );

            // send to server
            const decryptedToken = decryptToken(token);
            const res = await fetch(
                `${WP_API_BASE}/custom/v1/remove-from-favourites`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${decryptedToken}`,
                    },
                    body: JSON.stringify({
                        productId: productId,
                    }),
                }
            );
            const data = await res.json();
            invalidateCurrentProducts();
        } else {
            // add to favourites
            setFavouriteProducts((prev) => {
                const nextFavs = [
                    ...(prev || []),
                    {id: productId, title: productTitle},
                ];
                if (searchValue) {
                    const favFuse = new Fuse(nextFavs, fuseOptions);
                    const favResults = favFuse.search(searchValue);
                    setFavouriteSearchResults(favResults.map((r) => r.item));
                } else if (selectedProductsSection === "favourite") {
                    setFavouriteSearchResults(nextFavs);
                }
                return nextFavs;
            });

            showNotification(
                `Added ${productTitle} to favourites`,
                "success",
                1000
            );

            // send to server
            const decryptedToken = decryptToken(token);
            const res = await fetch(
                `${WP_API_BASE}/custom/v1/add-to-favourites`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${decryptedToken}`,
                    },
                    body: JSON.stringify({
                        productId: productId,
                        title: productTitle,
                    }),
                }
            );
            const data = await res.json();
            invalidateCurrentProducts();
        }
    };

    const handleCategoryToggle = (category) => {
        if (category === "all") {
            setSelectedCategories([]);
            return;
        }
        setSelectedCategories((previous) =>
            previous.includes(category)
                ? previous.filter((item) => item !== category)
                : [...previous, category]
        );
    };

    useEffect(() => {
        let filtered = allProducts;
        if (selectedCategories.length > 0) {
            const normalize = (value) =>
                decodeHtmlEntities(String(value || "")).trim().toLowerCase();
            const selected = selectedCategories.map(normalize);
            filtered = filtered.filter((product) =>
                product.categories?.some((category) => selected.includes(normalize(category)))
            );
        }
        if (searchValue) {
            filtered = new Fuse(filtered, fuseOptions)
                .search(searchValue)
                .map((result) => result.item);
        }
        setFilteredProducts(filtered);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategories, allProducts, searchValue]);

    const sections = [
        {id: "popular", label: "Popular", icon: Flame},
        {id: "categories", label: "Categories", icon: Grid2X2},
        {id: "custom", label: "Custom", icon: Plus},
        {id: "favourite", label: "Favourites", icon: Heart},
    ];
    const sectionCopy = {
        popular: "Browse products",
        categories: "Explore by category",
        custom: "Your custom products",
        favourite: "Your favourites",
    };
    const visibleProducts = selectedProductsSection === "categories"
        ? filteredProducts
        : displayedProducts;
    const selectedCount = allLinkedProducts?.length || 0;

    const renderProductItem = (product, index) => {
        const isTemporaryProduct = typeof product.id === "string" && product.id.startsWith("temp-");
        const isSelected = !!allLinkedProducts?.some((item) => item.ID === product.id);
        const isFavourite = !!favouriteProducts?.some((item) => item.id === product.id);
        const title = decodeHtmlEntities(product.title);

        return (
            <div
                key={product.id || index}
                data-product-id={product.id}
                className={`product-card picker-product ${isSelected ? "is-selected" : ""} ${isTemporaryProduct ? "is-saving" : ""}`}
            >
                <label className="picker-product-main" htmlFor={`picker-product-${product.id}`}>
                    <input
                        id={`picker-product-${product.id}`}
                        type="checkbox"
                        checked={isSelected}
                        disabled={isTemporaryProduct}
                        onChange={() => handleCheckboxChange(product.id)}
                    />
                    <span className="picker-product-check" aria-hidden="true">
                        {isSelected && <Check size={17} strokeWidth={3} />}
                    </span>
                    <span className="picker-product-name">{title}</span>
                    {isTemporaryProduct && <span className="picker-product-saving">Saving…</span>}
                </label>
                <div className="picker-product-actions">
                    <button
                        type="button"
                        className={`picker-icon-button picker-favourite ${isFavourite ? "is-favourite" : ""}`}
                        onClick={() => handleAddToFavourites(product.id, token)}
                        disabled={isTemporaryProduct}
                        aria-label={`${isFavourite ? "Remove" : "Add"} ${title} ${isFavourite ? "from" : "to"} favourites`}
                        title={isFavourite ? "Remove from favourites" : "Add to favourites"}
                    >
                        <Star size={20} fill={isFavourite ? "currentColor" : "none"} aria-hidden="true" />
                    </button>
                    {selectedProductsSection === "custom" && (
                        <button
                            type="button"
                            className="picker-icon-button picker-delete"
                            onClick={() => handleDeleteCustomProduct(product.id, token, shoppingListId, customProducts)}
                            disabled={isTemporaryProduct}
                            aria-label={`Delete ${title}`}
                            title="Delete custom product"
                        >
                            <Trash2 size={19} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="product-picker-root">
            <div ref={overlayRef} className="picker-backdrop close-product-overlay" />
            <section
                ref={panelRef}
                className="product-picker"
                role="dialog"
                aria-modal="true"
                aria-label="Add products to list"
            >
                <header className="picker-header">
                    <div className="picker-heading">
                        <div>
                            <p className="picker-eyebrow">YOUR SHOPPING LIST</p>
                            <h2>Add products</h2>
                        </div>
                        <button type="button" className="picker-close" onClick={closeOverlay} aria-label="Close products">
                            <X size={22} aria-hidden="true" />
                        </button>
                    </div>
                    <div className="picker-search">
                        <Search size={20} aria-hidden="true" />
                        <input
                            value={searchValue}
                            onChange={handleSearchProduct}
                            type="search"
                            placeholder="Search products"
                            aria-label="Search products"
                        />
                        {searchValue && (
                            <button
                                type="button"
                                onClick={() => handleSearchProduct({target: {value: ""}})}
                                aria-label="Clear search"
                            >
                                <X size={17} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                    <nav className="picker-tabs" aria-label="Product sections">
                        {sections.map(({id, label, icon: Icon}) => (
                            <button
                                type="button"
                                key={id}
                                className={`picker-tab ${selectedProductsSection === id ? "is-active" : ""}`}
                                onClick={() => {
                                    setSelectedProductsSection(id);
                                    productScrollerRef.current?.scrollTo(0);
                                }}
                                aria-current={selectedProductsSection === id ? "page" : undefined}
                            >
                                <Icon size={17} aria-hidden="true" />
                                <span>{label}</span>
                            </button>
                        ))}
                    </nav>
                </header>

                <div className="picker-controls">
                    {selectedProductsSection === "custom" && (
                        <form
                            className="picker-custom-form"
                            onSubmit={(event) => {
                                event.preventDefault();
                                handleCreateCustomProduct();
                            }}
                        >
                            <div className="picker-custom-field">
                                <input
                                    ref={customProductInputRef}
                                    type="text"
                                    placeholder="Name a product"
                                    aria-label="Custom product name"
                                    maxLength={maxLength}
                                    onChange={(event) => setCustomProductLength(event.target.value.length)}
                                />
                                <span>{customProductLength}/{maxLength}</span>
                            </div>
                            <button type="submit" className="picker-add-button">
                                <Plus size={18} aria-hidden="true" />
                                <span>Add</span>
                            </button>
                            {error && <p className="picker-form-error" role="alert">{error}</p>}
                        </form>
                    )}
                </div>

                <div
                    ref={productListRef}
                    className="picker-scroll-region"
                    data-lenis-prevent
                    style={{WebkitOverflowScrolling: "touch", overscrollBehavior: "contain"}}
                >
                    <div className="product-list-content picker-scroll-content">
                    {selectedProductsSection === "categories" && (
                        <CategoryFilter
                            categories={categories}
                            selectedCategories={selectedCategories}
                            onCategoryToggle={handleCategoryToggle}
                        />
                    )}

                        <div className="picker-list-heading">
                            <div>
                                <h3>{sectionCopy[selectedProductsSection]}</h3>
                                <p>
                                    {selectedProductsSection === "categories" && selectedCategories.length > 0
                                        ? `${selectedCategories.length} active ${selectedCategories.length === 1 ? "filter" : "filters"}`
                                        : selectedProductsSection === "custom"
                                        ? "Products you have added"
                                        : selectedProductsSection === "favourite"
                                        ? "Products you saved for later"
                                        : "Tap a product to add it to your list"}
                                </p>
                            </div>
                            <span className="picker-result-count">{visibleProducts.length} {visibleProducts.length === 1 ? "product" : "products"}</span>
                        </div>
                        {visibleProducts.length > 0 ? (
                            <div className="picker-product-grid">
                                {visibleProducts.map(renderProductItem)}
                            </div>
                        ) : (
                            <div className="picker-empty-state">
                                <div className="picker-empty-icon">
                                    {selectedProductsSection === "favourite" ? <Heart size={25} /> : <Search size={25} />}
                                </div>
                                <h3>{searchValue ? "No matching products" : selectedProductsSection === "favourite" ? "No favourites yet" : selectedProductsSection === "custom" ? "No custom products yet" : "No products found"}</h3>
                                <p>{searchValue ? "Try another search term or choose a different section." : selectedProductsSection === "favourite" ? "Tap the star on a product to keep it here." : selectedProductsSection === "custom" ? "Add your own product using the field above." : "Try a different category."}</p>
                            </div>
                        )}
                    </div>
                </div>

                <footer className="picker-footer">
                    <div className="picker-selection-summary">
                        <strong>{selectedCount}</strong>
                        <span>{selectedCount === 1 ? "product" : "products"} in your list</span>
                    </div>
                    <button type="button" className="picker-done" onClick={closeOverlay}>Done</button>
                </footer>
            </section>
        </div>
    );
}
