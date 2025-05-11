'use client';
import Button from '../../components/Button';
import gsap from 'gsap';
import { useEffect, useRef, useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import SearchIcon from '../svgs/SearchIcon';
import { decryptToken, WP_API_BASE, getAllCustomProducts } from '../../lib/helpers';
import "../../css/checkbox.css";
import CloseIcon from '../svgs/CloseIcon';
import { useParams } from 'next/navigation';
import Lenis from 'lenis';
import { useListContext } from '../../contexts/ListContext';
import ErrorIcon from '../svgs/ErrorIcon';
import TrashIcon from '../svgs/TranshIcon';

export default function AddProduct({
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
}) {
    const [products, setProducts] = useState(allProducts);
    const [favouriteProducts, setFavouriteProducts] = useState([]);

    const customProductInputRef = useRef(null);



    const [originalProducts] = useState(allProducts);
    const searchRef = useRef();
    const productListRef = useRef();
    const shoppingListId = useParams().id;
    const { lenis: globalLenis } = useListContext();
    const lenisRef = useRef(null);
    const rafIdRef = useRef(null);

    const [selectedProductsSection, setSelectedProductsSection] = useState('popular');

    // Create Fuse instance for fuzzy search
    const fuseOptions = {
        keys: ['title'],
        threshold: 0.3,
        distance: 100,
    };

    const fuse = useMemo(() => new Fuse(originalProducts, fuseOptions), [originalProducts]);

    const updateProductInShoppingList = async (productId, isAdding, token) => {
        if (!shoppingListId || !token) return;
        const decryptedToken = decryptToken(token);
        const isProductBagged = baggedProducts?.some(product => product.id === productId);
        // 
        const productTitle = products.find(product => product.id === productId)?.title || customProducts.find(product => product.id === productId)?.title;
        if (isAdding) {
            setCheckedProducts(prev => {
                const uniqueProducts = prev?.filter(product => product.id !== productId) || [];
                return [...uniqueProducts, { id: productId, title: productTitle }];
            });
            setAllLinkedProducts(prev => {
                const uniqueProducts = prev?.filter(product => product.ID !== productId) || [];
                return [...uniqueProducts, { ID: productId, title: productTitle }];
            });
            setTotalProductCount(prev => prev + 1);
        } else {
            setCheckedProducts(prev => prev?.filter(product => product.id !== productId));
            setBaggedProducts(prev => prev?.filter(product => product.id !== productId));
            setAllLinkedProducts(prev => prev?.filter(product => product.ID !== productId));
            setTotalProductCount(prev => prev - 1);
            if (isProductBagged) {
                setBaggedProductCount(prev => prev - 1);
                setProgress(prev => {
                    const newProgress = prev - (1 / totalProductCount) * 100;
                    return newProgress < 0 ? 0 : newProgress;
                });
            }
        }

        try {
            const response = await fetch(`${WP_API_BASE}/custom/v1/update-shopping-list`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${decryptedToken}`,
                },
                body: JSON.stringify({
                    shoppingListId,
                    productId,
                    action: isAdding ? 'add' : 'remove',
                }),
            });



            const data = await response.json();

        } catch (error) {
            console.error('Error:', error);
        }
    };

    let isUpdating = false;
    const handleCheckboxChange = (productId, token) => {
        if (isUpdating) return;
        isUpdating = true;
        const isCurrentlyChecked = allLinkedProducts?.some(product => product.ID === productId);
        updateProductInShoppingList(productId, !isCurrentlyChecked, token).finally(() => {
            isUpdating = false;
        });
    };

    useEffect(() => {
        gsap.set(".close-product-overlay-btn", { y: 200, opacity: 1 });
        gsap.to(".close-product-overlay-btn", { y: 0, duration: 0.5, ease: "power2.out" });
    }, []);

    // Search functionality with fuzzy search
    const [searchValue, setSearchValue] = useState("");

    const handleSearchProduct = (e) => {
        const value = e.target.value;
        setSearchValue(value);

        if (value === "") {
            setProducts(originalProducts);
        } else {
            const searchResults = fuse.search(value);
            const filteredProducts = searchResults.map(result => result.item);
            setProducts(filteredProducts);
        }
    };

    // Animate search results with simple fade-in
    useEffect(() => {
        if (productListRef.current) {
            const productItems = productListRef.current.querySelectorAll('.product-list-content > div:not(.bg-gray-800)');
            gsap.fromTo(
                productItems,
                { opacity: 0 },
                {
                    opacity: 1,
                    duration: 0.3,
                    ease: "power2.out",
                }
            );
        }
    }, [products]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                document.body.style.overflow = 'auto';
                setProductOverlay(false);
            }
        };
        const handleOutsideClick = (event) => {
            if (event.target.classList.contains('close-product-overlay')) {
                document.body.style.overflow = 'auto';
                setProductOverlay(false);
            }
        };

        window.addEventListener('click', handleOutsideClick);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = 'auto';
            window.removeEventListener('click', handleOutsideClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [setProductOverlay]);

    useEffect(() => {
        window.scrollTo({ top: 0 });
        if (globalLenis?.current) {
            globalLenis.current.stop();
        }

        if (productListRef.current) {
            lenisRef.current = new Lenis({
                wrapper: productListRef.current,
                content: productListRef.current.querySelector('.product-list-content'),
                lerp: 0.1,
                smoothWheel: true,
                touchMultiplier: 2, // Add this for better touch handling
                smoothTouch: true,    // Enable smooth scrolling for touch devices
                infinite: false,
            });

            const raf = (time) => {
                if (lenisRef.current) {
                    lenisRef.current.raf(time);
                    rafIdRef.current = requestAnimationFrame(raf);
                }
            };
            rafIdRef.current = requestAnimationFrame(raf);
            productListRef.current.style.touchAction = 'pan-y';
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
        if (customProductInputRef.current.value.trim() === '' || !customProductInputRef.current) {
            setError('Please enter a product name');
            setTimeout(() => {
                setError(null);
            }, 4000);
            return
        }

        const customProductTitle = customProductInputRef.current.value.trim();
        if (customProductTitle) {
            const newCustomProduct = {
                title: customProductTitle,
            };

            const animatedProduct = { ...newCustomProduct, id: Date.now() };

            setTimeout(() => {
                if (productListRef.current) {
                    const firstProduct = productListRef.current.querySelector('.product-list-content > div:nth-child(3)');
                    if (firstProduct) {
                        gsap.fromTo(
                            firstProduct,
                            { opacity: 0.4, y: -100 },
                            { opacity: 1, y: 0, duration: 1.2, ease: "power2.out" }
                        );
                    }
                }
            }, 1);

            customProductInputRef.current.value = '';
            setCustomProducts((prev) => [animatedProduct, ...prev]);
        }

        const decryptedToken = decryptToken(token);
        const res = await fetch(`${WP_API_BASE}/custom/v1/create-custom-product`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${decryptedToken}`
            },
            body: JSON.stringify({
                title: customProductTitle,
                // shoppingListId: shoppingListId,
            }),
        })
        const data = await res.json()
        const customProducts = await getAllCustomProducts(token);
        setCustomProducts(customProducts);
    }





    // Delete custom product
    const handleDeleteCustomProduct = async (productId, token, shoppingListId, customProductss) => {
        // Animate the products getting deleted
        if (productListRef.current) {
            const productDiv = productListRef.current.querySelector(`.product-list-content > div:nth-child(${customProductss.findIndex(p => p.id === productId) + 3})`);
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
        setCustomProducts((prev) => prev.filter(p => p.id !== productId));

        // Delete the actual product in the server
        const decryptedToken = decryptToken(token);
        const res = await fetch(`${WP_API_BASE}/custom/v1/delete-custom-product`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${decryptedToken}`
            },
            body: JSON.stringify({
                productId: productId,
                shoppingListId: shoppingListId,
            }),
        })
        const data = await res.json()

        // if in linked products set counter minus 1
        const isProductLinked = allLinkedProducts?.some(product => product.ID === productId);
        if (isProductLinked) {
            setTotalProductCount((prev) => prev - 1);
        }
        setAllLinkedProducts((prev) => prev?.filter(product => product.ID !== productId));
        setCheckedProducts((prev) => prev?.filter(product => product.id !== productId));


        // if in bagged products set counter minus 1
        const isProductBagged = baggedProducts?.some(product => product.id === productId);
        if (isProductBagged) {
            setBaggedProductCount((prev) => prev - 1);
        }
        setBaggedProducts((prev) => prev?.filter(product => product.id !== productId));

        setProgress((prev) => {
            const newProgress = prev - (1 / totalProductCount) * 100;
            return newProgress < 0 ? 0 : newProgress;
        });
    }


    // Reusable NoProductsFound component
    function NoProductsFound({ mtClass = "mt-28" }) {
        return (
            <div className={`w-full font-quicksand uppercase ${mtClass} flex items-center justify-center text-gray-400 text-2xl font-bold`}>
                No products found
            </div>
        );
    }


    return (
        <div className="w-full absolute top-0">
            <div className="fixed top-4 right-6 w-10 h-10 z-[100]">
                <CloseIcon
                    className="absolute top-4 right-4 w-8 h-8 text-white cursor-pointer"
                    onClick={() => {
                        setProductOverlay(false);
                    }}
                />
            </div>
            <div className="fixed top-0 z-[99] inset-0 w-full h-full bg-[#000000ef] blur-sm close-product-overlay"></div>
            <div className="relative top-0 ">
                <div className="absolute top-0 z-[100]  inset-x-0 bg-black gap-4 left-1/2 -translate-x-1/2 w-[90%] md:w-1/2 md:min-w-[550px] max-w-[750px] flex flex-col items-center mt-3 mb-8 md:my-6">
                    <div className="w-full bg-gray-700 sticky top-0 z-20 rounded-md">
                        <div className="relative flex items-center">
                            <input
                                value={searchValue}
                                onChange={handleSearchProduct}
                                ref={searchRef}
                                placeholder="Search for a Product..."
                                className="w-full rounded-md border-2 transition-colors duration-200 border-transparent focus:border-primary outline-0 placeholder:text-2xl md:placeholder:font-black h-full peer py-3 px-2 text-2xl pr-10 focus:pr-2"
                            />
                            <div className="absolute right-2 h-full grid place-items-center peer-focus:opacity-0 transition-opacity duration-200">
                                <SearchIcon className="w-8 h-8 text-white" />
                            </div>
                        </div>
                    </div>

                    <div
                        ref={productListRef}
                        className="w-full bg-gray-700 pb-16 md:pb-0 rounded-md h-[85vh] mb-20 sm:mb-12 overflow-y-auto touch-pan-y"
                        style={{
                            WebkitOverflowScrolling: 'touch',
                            overscrollBehavior: 'contain',
                        }}
                    >
                        <div className="product-list-content flex flex-col gap-3 px-4 pb-4">

                            {/* Navigation buttons */}
                            <div className="flex w-min whitespace-pre relative font-bold  overflow-hidden rounded-br-xl -left-4 mb-4">
                                <div onClick={() => setSelectedProductsSection("popular")} className={`py-2 pl-5 pr-4 ${selectedProductsSection === "popular" ? "bg-gray-700 hover:bg-gray-700" : "hover:opacity-70 bg-gray-800 cursor-pointer"}`} >Popular</div>
                                <div onClick={() => setSelectedProductsSection("custom")} className={`py-2 px-4  ${selectedProductsSection === "custom" ? "bg-gray-700 hover:bg-gray-700" : "hover:opacity-70 bg-gray-800 cursor-pointer"}`} >Custom</div>
                                <div onClick={() => setSelectedProductsSection("favourite")} className={`py-2 px-4  ${selectedProductsSection === "favourite" ? "bg-gray-700 hover:bg-gray-700" : "hover:opacity-70 bg-gray-800 cursor-pointer"}`} >Favourites</div>
                            </div>


                            {/* Custom Products Input */}
                            {
                                selectedProductsSection === "custom" &&
                                (
                                    <div className="mb-4">
                                        <div className="w-full flex items-center  text-gray-400 text-lg font-bold group">
                                            <input ref={customProductInputRef} placeholder='Input Product' className="w-full px-3 py-[9.5px] peer group-hover:!border-primary rounded-l-md h-full text-white !border-r-0 placeholder:text-white  !border-blue-800  focus:!border-primary"></input>
                                            <button onClick={handleCreateCustomProduct} className="whitespace-pre  px-3 py-1.5 !border-blue-800 peer  group-hover:!border-primary  peer-focus:!border-primary cursor-pointer hover:!border-primary  rounded-r-md h-full bg-blue-800 text-white">Add product</button>
                                        </div>

                                        {
                                            error && (
                                                <p className="w-min mt-2 whitespace-pre ml-1 py-2 px-2 bg-red-400 rounded-sm text-white flex gap-1 items-center text-xs"><ErrorIcon className={"h-5 w-5"} />{error}</p>

                                            )
                                        }
                                    </div>
                                )
                            }


                            {
                                (selectedProductsSection === "popular" ? products :
                                    selectedProductsSection === "custom" ? customProducts :
                                        favouriteProducts)?.map((product, index) => (

                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCheckboxChange(product.id, token);
                                                }}
                                                key={product.id || index}
                                                className={`border cursor-pointer px-4 py-3 rounded-md bg-gray-900 hover:bg-gray-800 duration-200 ease-linear transition-colors text-white flex items-center justify-between gap-2 ${allLinkedProducts?.some(p => p.ID === product.id) ? 'border-primary' : ''}`}
                                            >
                                                <div className="flex items-center gap-2 font-bold text-xl checkbox-wrapper-28">
                                                    <div className="checkbox-wrapper-28">
                                                        <input
                                                            id={`checkbox-${product.id}`}
                                                            type="checkbox"
                                                            className="promoted-input-checkbox peer"
                                                            checked={!!allLinkedProducts?.some(p => p.ID === product.id)}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                handleCheckboxChange(product.id, token);
                                                            }}
                                                        />
                                                        <label
                                                            htmlFor={`checkbox-${product.id}`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleCheckboxChange(product.id, token);
                                                            }}
                                                        ></label>
                                                        <svg className="absolute -z-0">
                                                            <use href="#checkmark-28" />
                                                        </svg>
                                                        <svg xmlns="http://www.w3.org/2000/svg" style={{ display: 'none' }}>
                                                            <symbol id="checkmark-28" viewBox="0 0 24 24">
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeMiterlimit="10"
                                                                    fill="none"
                                                                    d="M22.9 3.7l-15.2 16.6-6.6-7.1"
                                                                />
                                                            </symbol>
                                                        </svg>
                                                    </div>
                                                    {product.title}
                                                </div>
                                                <div className="flex items-center gap-2 md:gap-6">

                                                    {/* if is custom prodiuct display custom */}
                                                    {
                                                        selectedProductsSection === "custom" &&
                                                        <div onClick={((e) => {
                                                            e.stopPropagation();
                                                            handleDeleteCustomProduct(product.id, token, shoppingListId, customProducts);

                                                        })} className="text-sm font-bold text-gray-400">
                                                            <TrashIcon className="w-6 h-6 text-yellow-500 hover:text-white transition-colors duration-200 cursor-pointer" />
                                                        </div>
                                                    }
                                                    <div className={`flex items-center transition-opacity duration-300 gap-2 ${allLinkedProducts?.some(p => p.ID === product.id) ? 'opacity-100' : 'opacity-0'}`}>
                                                        <CloseIcon className="w-6 h-6 text-red-500 hover:text-white transition-colors duration-200 cursor-pointer" />
                                                    </div>
                                                </div>
                                            </div>

                                        )
                                        )
                            }


                            {
                                selectedProductsSection === "popular" && products.length === 0 && (
                                    <NoProductsFound />
                                )
                            }
                            {
                                selectedProductsSection === "custom" && customProducts.length === 0 && (
                                    <NoProductsFound mtClass="mt-14" />
                                )
                            }
                            {
                                selectedProductsSection === "favourite" && favouriteProducts.length === 0 && (
                                    <NoProductsFound />
                                )
                            }


                        </div>
                    </div>
                </div>
                <div className="fixed bottom-4 sm:hidden w-full mx-auto justify-center flex gap-2 opacity-0 z-[100] close-product-overlay-btn">
                    <Button
                        cta="Close Products List"
                        color="#82181a"
                        hover="inwards"
                        action="close-product-overlay"
                        overrideDefaultClasses="bg-red-500 whitespace-nowrap text-black text-sm md:text-base"
                        light={true}
                        setProductOverlay={() => {
                            document.body.style.overflow = 'auto';
                            setProductOverlay(false);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}