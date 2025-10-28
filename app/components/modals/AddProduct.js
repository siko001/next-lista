"use client";
import Button from "../../components/Button";
import gsap from "gsap";
import {useEffect, useRef, useState, useMemo} from "react";
import Fuse from "fuse.js";
import SearchIcon from "../svgs/SearchIcon";
import {
    decryptToken,
    WP_API_BASE,
    getAllCustomProducts,
    decodeHtmlEntities,
} from "../../lib/helpers";

import {INGREDIENT_NAME_MAX_LENGTH} from "../../lib/config";
import "../../css/checkbox.css";
import CloseIcon from "../svgs/CloseIcon";
import {useParams} from "next/navigation";
import Lenis from "lenis";
import {useListContext} from "../../contexts/ListContext";
import ErrorIcon from "../svgs/ErrorIcon";
import TrashIcon from "../svgs/TranshIcon";
import StarIcon from "../svgs/StarIcon";
import CategoryFilter from "../CategoryFilter";

// Contexts
import {useNotificationContext} from "../../contexts/NotificationContext";

export default function AddProduct({
    favourites,
    totalProductCount,
    setTotalProductCount,
    baggedProductCount,
    setBaggedProductCount,
    progress,
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
    const [products, setProducts] = useState(allProducts);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState(allProducts);
    const [favouriteProducts, setFavouriteProducts] = useState(favourites);
    const [initialCustomProducts, setInitialCustomProducts] =
        useState(customProducts);
    const [searchResults, setSearchResults] = useState(null);
    const [popularSearchResults, setPopularSearchResults] = useState(null);
    const [favouriteSearchResults, setFavouriteSearchResults] = useState(null);
    const customProductInputRef = useRef(null);
    const [customProductLength, setCustomProductLength] = useState(0);
    const [savingProductId, setSavingProductId] = useState(null); // Track which product is being saved
    const [savingProduct, setSavingProduct] = useState(null); // Track which product is being saved
    const maxLength = INGREDIENT_NAME_MAX_LENGTH;

    const {showNotification} = useNotificationContext();

    const [originalProducts] = useState(allProducts);
    const searchRef = useRef();
    const productListRef = useRef();
    const shoppingListId = useParams().id;
    const {lenis: globalLenis} = useListContext();
    const lenisRef = useRef(null);
    const rafIdRef = useRef(null);

    const [selectedProductsSection, setSelectedProductsSection] =
        useState("popular");
    const overlayRef = useRef(null);
    const panelRef = useRef(null);

    // Create Fuse instance for fuzzy search
    const fuseOptions = {
        keys: ["title"],
        threshold: 0.3,
        distance: 100,
    };

    const fuse = useMemo(
        () => new Fuse(originalProducts, fuseOptions),
        [originalProducts]
    );

    // Update initialCustomProducts when customProducts prop changes
    useEffect(() => {
        setInitialCustomProducts(customProducts);
    }, [customProducts]);

    const updateProductInShoppingList = async (productId, isAdding, token) => {
        if (!shoppingListId || !token) return;
        const decryptedToken = decryptToken(token);
        const isProductBagged = baggedProducts?.some(
            (product) => product.id === productId
        );
        //
        const productTitle =
            products.find((product) => product.id === productId)?.title ||
            customProducts.find((product) => product.id === productId)?.title;
        if (isAdding) {
            setCheckedProducts((prev) => {
                const uniqueProducts =
                    prev?.filter((product) => product.id !== productId) || [];
                return [
                    ...uniqueProducts,
                    {id: productId, title: productTitle},
                ];
            });
            setAllLinkedProducts((prev) => {
                const uniqueProducts =
                    prev?.filter((product) => product.ID !== productId) || [];
                return [
                    ...uniqueProducts,
                    {ID: productId, title: productTitle},
                ];
            });
            setTotalProductCount((prev) => prev + 1);
        } else {
            setCheckedProducts((prev) =>
                prev?.filter((product) => product.id !== productId)
            );
            setBaggedProducts((prev) =>
                prev?.filter((product) => product.id !== productId)
            );
            setAllLinkedProducts((prev) =>
                prev?.filter((product) => product.ID !== productId)
            );
            setTotalProductCount((prev) => prev - 1);
            if (isProductBagged) {
                setBaggedProductCount((prev) => prev - 1);
                setProgress((prev) => {
                    const newProgress = prev - (1 / totalProductCount) * 100;
                    return newProgress < 0 ? 0 : newProgress;
                });
            }
        }

        try {
            const response = await fetch(
                `${WP_API_BASE}/custom/v1/update-shopping-list`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${decryptedToken}`,
                    },
                    body: JSON.stringify({
                        shoppingListId,
                        productId,
                        action: isAdding ? "add" : "remove",
                    }),
                }
            );

            const data = await response.json();
        } catch (error) {
            console.error("Error:", error);
        }
    };

    let isUpdating = false;
    const handleCheckboxChange = (productId, token) => {
        if (isUpdating) return;
        isUpdating = true;
        const isCurrentlyChecked = allLinkedProducts?.some(
            (product) => product.ID === productId
        );
        updateProductInShoppingList(
            productId,
            !isCurrentlyChecked,
            token
        ).finally(() => {
            isUpdating = false;
        });
    };

    useEffect(() => {
        gsap.set(".close-product-overlay-btn", {y: 200, opacity: 1});
        gsap.to(".close-product-overlay-btn", {
            y: 0,
            duration: 0.5,
            ease: "power2.out",
        });
    }, []);

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

    const closeOverlay = () => {
        const overlay = overlayRef.current;
        const panel = panelRef.current;
        if (!overlay || !panel) {
            document.body.style.overflow = "auto";
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
                document.body.style.overflow = "auto";
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
    };

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
            document.body.style.overflow = "auto";
            window.removeEventListener("click", handleOutsideClick);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [setProductOverlay]);

    useEffect(() => {
        window.scrollTo({top: 0});
        if (globalLenis?.current) {
            globalLenis.current.stop();
        }

        if (productListRef.current) {
            lenisRef.current = new Lenis({
                wrapper: productListRef.current,
                content: productListRef.current.querySelector(
                    ".product-list-content"
                ),
                lerp: 0.1,
                smoothWheel: true,
                touchMultiplier: 2, // Add this for better touch handling
                smoothTouch: true, // Enable smooth scrolling for touch devices
                infinite: false,
            });

            const raf = (time) => {
                if (lenisRef.current) {
                    lenisRef.current.raf(time);
                    rafIdRef.current = requestAnimationFrame(raf);
                }
            };
            rafIdRef.current = requestAnimationFrame(raf);
            productListRef.current.style.touchAction = "pan-y";
        }

        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }

            if (globalLenis?.current) {
                globalLenis.current.start();
            }
            if (lenisRef.current) {
                lenisRef.current.destroy();
                lenisRef.current = null;
            }
        };
    }, [globalLenis]);

    // Create Custom Product
    const [error, setError] = useState(null);
    const handleCreateCustomProduct = async () => {
        if (
            customProductInputRef.current.value.trim() === "" ||
            !customProductInputRef.current
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

            // Set the currently saving product ID
            setSavingProductId(tempId);

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
        const fetchedCustomProducts = await getAllCustomProducts(token);
        setCustomProducts(fetchedCustomProducts);
        setSavingProductId(null); // Clear saving state
    };

    // Delete custom product
    const handleDeleteCustomProduct = async (
        productId,
        token,
        shoppingListId,
        customProductss
    ) => {
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
        // title
        const productTitle =
            products.find((product) => product.id === productId)?.title ||
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
        }
    };

    // Reusable NoProductsFound component
    function NoProductsFound({mtClass = "mt-28"}) {
        return (
            <div
                className={`w-full font-quicksand uppercase ${mtClass} flex items-center justify-center text-gray-400 text-2xl font-bold`}
            >
                No products found
            </div>
        );
    }

    // Handle category toggle
    const handleCategoryToggle = (category) => {
        if (category === "all") {
            setSelectedCategories([]);
            return;
        }

        setSelectedCategories((prev) => {
            if (prev.includes(category)) {
                return prev.filter((c) => c !== category);
            } else {
                return [...prev, category];
            }
        });
    };

    // Filter products based on selected categories and search term
    useEffect(() => {
        let filtered = allProducts;

        // Apply category filter (normalize/decoded to handle &amp; vs & and case)
        if (selectedCategories.length > 0) {
            const norm = (s) =>
                decodeHtmlEntities(String(s || ""))
                    .trim()
                    .toLowerCase();
            const selectedNorm = selectedCategories.map(norm);
            filtered = allProducts.filter((product) =>
                product.categories?.some((category) =>
                    selectedNorm.includes(norm(category))
                )
            );
        }

        // Apply search filter if there's a search term
        if (searchValue) {
            const fuse = new Fuse(filtered, fuseOptions);
            const results = fuse.search(searchValue);
            filtered = results.map((result) => result.item);
        }

        setFilteredProducts(filtered);
        setProducts(filtered);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategories, allProducts, searchValue]);

    const renderProductItem = (product, index) => {
        const isTemporaryProduct =
            typeof product.id === "string" && product.id.startsWith("temp-");

        const handleClick = (e) => {
            if (isTemporaryProduct) return; // Prevent interaction with temporary products
            e.stopPropagation();
            handleCheckboxChange(product.id, token);
        };

        const handleCheckboxClick = (e) => {
            if (isTemporaryProduct) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.stopPropagation();
            handleCheckboxChange(product.id, token);
        };

        const handleFavouriteClick = (e) => {
            if (isTemporaryProduct) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.stopPropagation();
            handleAddToFavourites(product.id, token);
        };

        return (
            <div
                onClick={handleClick}
                key={product.id || index}
                data-product-id={product.id}
                className={`product-card border ml-4 px-4 py-3 rounded-md text-black duration-200 ease-linear transition-colors dark:text-white flex items-center justify-between gap-2 group ${
                    allLinkedProducts?.some((p) => p.ID === product.id)
                        ? "border-primary"
                        : ""
                } ${
                    isTemporaryProduct
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                }`}
            >
                <div className="flex items-center gap-2 font-bold text-xl checkbox-wrapper-28">
                    <div className="checkbox-wrapper-28">
                        <input
                            id={`checkbox-${product.id}`}
                            type="checkbox"
                            className={`promoted-input-checkbox peer ${
                                isTemporaryProduct ? "cursor-not-allowed" : ""
                            }`}
                            checked={
                                !!allLinkedProducts?.some(
                                    (p) => p.ID === product.id
                                )
                            }
                            onChange={handleCheckboxClick}
                            disabled={isTemporaryProduct}
                        />
                        <label
                            htmlFor={`checkbox-${product.id}`}
                            onClick={(e) => {
                                e.preventDefault();
                                if (isTemporaryProduct) return;
                                handleCheckboxChange(product.id, token);
                            }}
                            className={
                                isTemporaryProduct ? "cursor-not-allowed" : ""
                            }
                        ></label>
                        <svg viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" fill="none" />
                        </svg>
                    </div>
                    {decodeHtmlEntities(product.title)}
                    {isTemporaryProduct && (
                        <span className="text-xs text-gray-400 ml-2">
                            Saving...
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 md:gap-6">
                    <div
                        onClick={handleFavouriteClick}
                        className={`text-sm font-bold text-gray-400 block ${
                            favouriteProducts?.some((p) => p.id === product.id)
                                ? "opacity-100"
                                : isTemporaryProduct
                                ? "opacity-50"
                                : "sm:opacity-0 group-hover:opacity-100"
                        } transition-opacity duration-200 ${
                            isTemporaryProduct ? "cursor-not-allowed" : ""
                        }`}
                    >
                        <StarIcon
                            className={`w-6 h-6 transition-colors duration-200 ${
                                isTemporaryProduct
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "hover:text-yellow-500 cursor-pointer"
                            } ${
                                favouriteProducts?.some(
                                    (p) => p.id === product.id
                                )
                                    ? "fill-yellow-500 text-yellow-500 hover:opacity-50 transition-opacity"
                                    : ""
                            }`}
                        />
                    </div>

                    {allLinkedProducts?.some((p) => p.ID === product.id) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                updateProductInShoppingList(
                                    product.id,
                                    false,
                                    token
                                );
                            }}
                            className="rounded-full text-red-500 !border-transparent cursor-pointer hover:border-transparent transition-colors duration-200"
                            aria-label="Remove from list"
                            title="Remove from list"
                        >
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    )}

                    {selectedProductsSection === "custom" && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustomProduct(
                                    product.id,
                                    token,
                                    shoppingListId,
                                    customProducts
                                );
                            }}
                            className="text-red-500 hover:text-red-400 cursor-pointer transition-colors duration-200 border-none hover:border-none focus:border-none outline-none focus:outline-none ring-0 focus:ring-0 focus:ring-offset-0"
                            style={{WebkitTapHighlightColor: "transparent"}}
                            aria-label="Delete custom product"
                            title="Delete custom product"
                        >
                            <TrashIcon className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full absolute top-0">
            <div className="fixed lg:block hidden top-4 right-6 w-10 h-10 z-[100]">
                <CloseIcon
                    className="sticky top-4 right-4 w-8 h-8 text-red-500 cursor-pointer"
                    onClick={() => {
                        closeOverlay();
                    }}
                />
            </div>
            <div
                ref={overlayRef}
                className="fixed top-0 z-[99] inset-0 w-full h-full  blur-sm close-product-overlay"
            ></div>
            <div className="relative top-0 ">
                <div
                    ref={panelRef}
                    className="absolute top-0 z-[100]  inset-x-0  gap-4 left-1/2 -translate-x-1/2 w-[90%] md:w-1/2 sm:min-w-[550px] max-w-[750px] md:min-w-[750px] lg:min-w-[830px] lg:max-w-[875px] xl:min-w-[900px] xl:max-w-[900px] flex flex-col items-center mt-3 mb-8 md:my-6"
                >
                    <div className="w-full bg-gray-300 dark:bg-gray-700 sticky top-0 z-20 rounded-md">
                        <div className="relative flex items-center">
                            <input
                                value={searchValue}
                                onChange={handleSearchProduct}
                                ref={searchRef}
                                placeholder="Search for a Product..."
                                className="w-full rounded-md border-2 transition-colors duration-200 search-input border-transparent focus:border-primary outline-0 placeholder:text-2xl md:placeholder:font-black h-full peer py-3 px-2 text-2xl pr-10 focus:pr-2"
                            />
                            <div className="absolute right-2 h-full grid place-items-center peer-focus:opacity-0 transition-opacity duration-200">
                                <SearchIcon className="w-8 h-8 brand-color" />
                            </div>
                        </div>
                    </div>

                    <div
                        ref={productListRef}
                        className="w-full search-input pb-16 md:pb-0 rounded-md h-[85vh] mb-20 sm:mb-12 overflow-y-auto touch-pan-y"
                        style={{
                            WebkitOverflowScrolling: "touch",
                            overscrollBehavior: "contain",
                        }}
                    >
                        <div className="product-list-content flex flex-col gap-3 pr-4 pb-4 relative">
                            <div className=" w-full overflow-x-auto !scrollbar-hide scrollbar-w-0 scrollbar-h-0 mb-4 sticky -left-4 top-0 z-20">
                                <div className="inline-flex whitespace-nowrap font-bold relative  font-quicksand ">
                                    <div
                                        onClick={() =>
                                            setSelectedProductsSection(
                                                "popular"
                                            )
                                        }
                                        className={`py-2 pl-5 pr-4 ${
                                            selectedProductsSection ===
                                            "popular"
                                                ? "menu-selected"
                                                : "menu cursor-pointer duration-200 ease-in transition-colors"
                                        }`}
                                    >
                                        Popular
                                    </div>

                                    <div
                                        onClick={() =>
                                            setSelectedProductsSection(
                                                "categories"
                                            )
                                        }
                                        className={`py-2 pl-5 pr-4 ${
                                            selectedProductsSection ===
                                            "categories"
                                                ? "menu-selected"
                                                : "menu cursor-pointer duration-200 ease-in transition-colors"
                                        }`}
                                    >
                                        Categories
                                    </div>

                                    <div
                                        onClick={() =>
                                            setSelectedProductsSection("custom")
                                        }
                                        className={`py-2 px-4  ${
                                            selectedProductsSection === "custom"
                                                ? "menu-selected"
                                                : "menu cursor-pointer duration-200 ease-in transition-colors"
                                        }`}
                                    >
                                        Custom
                                    </div>
                                    <div
                                        onClick={() =>
                                            setSelectedProductsSection(
                                                "favourite"
                                            )
                                        }
                                        className={`py-2 px-4  ${
                                            selectedProductsSection ===
                                            "favourite"
                                                ? "menu-selected rounded-br-xl"
                                                : "menu cursor-pointer rounded-br-xl"
                                        }`}
                                    >
                                        Favourites
                                    </div>
                                </div>
                            </div>
                            {/* Navigation tabs (scrollable only on this row) */}

                            {/* Custom Products Input */}
                            {selectedProductsSection === "custom" && (
                                <div className="mb-4 ml-4">
                                    <div className="w-full flex items-center text-gray-400 text-lg font-bold group relative ">
                                        <div className="w-full relative">
                                            <input
                                                ref={customProductInputRef}
                                                placeholder="Input Product"
                                                maxLength={maxLength}
                                                onChange={(e) => {
                                                    const value =
                                                        e.target.value.slice(
                                                            0,
                                                            maxLength
                                                        );
                                                    e.target.value = value;
                                                    setCustomProductLength(
                                                        value.length
                                                    );
                                                }}
                                                className="w-full px-3 py-[9.5px] pr-12 sm:pr-14 md:pr-16 peer group-hover:!border-primary rounded-l-md h-full text-black dark:text-white !border-r-0 placeholder:text-gray-700 dark:placeholder:text-white !border-blue-800 focus:!border-primary"
                                            />
                                            <div className="hidden peer-focus:block text-xs sm:text-sm md:text-base absolute right-2 top-[50%] -translate-y-1/2">
                                                <span>
                                                    {customProductLength}
                                                </span>
                                                &nbsp;/&nbsp;{maxLength}
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleCreateCustomProduct}
                                            className="whitespace-pre px-3 py-1.5 !border-blue-800 peer group-hover:!border-primary peer-focus:!border-primary cursor-pointer hover:!border-primary rounded-r-md h-full bg-blue-800 text-white"
                                        >
                                            Add product
                                        </button>
                                    </div>

                                    {error && (
                                        <p className="w-min mt-2 whitespace-pre ml-1 py-2 px-2 bg-red-400 rounded-sm text-white flex gap-1 items-center text-xs">
                                            <ErrorIcon className={"h-5 w-5"} />
                                            {error}
                                        </p>
                                    )}
                                </div>
                            )}

                            {selectedProductsSection === "categories" && (
                                <>
                                    <CategoryFilter
                                        categories={categories}
                                        selectedCategories={selectedCategories}
                                        onCategoryToggle={handleCategoryToggle}
                                    />
                                    {filteredProducts.length === 0 ? (
                                        <div className=" w-full font-quicksand text-center uppercase mt-6 flex items-center justify-center text-gray-400 text-2xl font-bold">
                                            {selectedCategories.length > 0
                                                ? "No products matched these filters"
                                                : "No products found"}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            {filteredProducts.map(
                                                renderProductItem
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {selectedProductsSection === "popular" &&
                                (displayedProducts?.length > 0 ? (
                                    displayedProducts.map((product, index) =>
                                        renderProductItem(product, index)
                                    )
                                ) : (
                                    <NoProductsFound />
                                ))}

                            {selectedProductsSection === "custom" &&
                                (displayedProducts?.length > 0 ? (
                                    displayedProducts.map((product, index) =>
                                        renderProductItem(product, index)
                                    )
                                ) : (
                                    <NoProductsFound
                                        mtClass={
                                            searchValue ? "mt-28" : "mt-14"
                                        }
                                    />
                                ))}

                            {selectedProductsSection === "favourite" &&
                                (displayedProducts?.length > 0 ? (
                                    displayedProducts.map((product, index) =>
                                        renderProductItem(product, index)
                                    )
                                ) : (
                                    <NoProductsFound />
                                ))}
                        </div>
                    </div>
                </div>
                <div className="fixed bottom-4 lg:hidden w-full mx-auto justify-center flex gap-2 opacity-0 z-[100] close-product-overlay-btn">
                    <Button
                        cta="Close Products List"
                        color="#82181a"
                        hover="inwards"
                        action="close-product-overlay"
                        overrideDefaultClasses="bg-red-500 whitespace-nowrap text-black text-sm md:text-base"
                        light={true}
                        setProductOverlay={closeOverlay}
                    />
                </div>
            </div>
        </div>
    );
}
