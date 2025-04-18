'use client';
import Button from '../../components/Button';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import SearchIcon from '../svgs/SearchIcon';
import { decryptToken, WP_API_BASE } from '../../lib/helpers';
import "../../css/checkbox.css";
import CloseIcon from '../svgs/CloseIcon';
import { useParams } from 'next/navigation';
import Lenis from 'lenis';
import { useListContext } from '../../contexts/ListContext';

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
}) {
    const [products, setProducts] = useState(allProducts);
    const [originalProducts] = useState(allProducts);
    const searchRef = useRef();
    const productListRef = useRef();
    const shoppingListId = useParams().id;
    const { lenis: globalLenis } = useListContext();
    const lenisRef = useRef(null);
    const rafIdRef = useRef(null); // Store requestAnimationFrame ID

    const updateProductInShoppingList = async (productId, isAdding, token) => {
        if (!shoppingListId || !token) return;
        const decryptedToken = decryptToken(token);
        const isProductBagged = baggedProducts?.some(product => product.id === productId);
        const productTitle = products.find(product => product.id === productId)?.title;

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
            await response.json();
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

    // Search functionality
    const [searchValue, setSearchValue] = useState("");

    const handleSearchProduct = (e) => {
        const value = e.target.value.toLowerCase();
        setSearchValue(value);
        if (value === "") {
            setProducts(originalProducts);
        } else {
            const filteredProducts = originalProducts.filter(product =>
                product.title.toLowerCase().includes(value)
            );
            setProducts(filteredProducts);
        }
    };

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

        // Initialize Lenis for the product list
        if (productListRef.current) {
            lenisRef.current = new Lenis({
                wrapper: productListRef.current,
                content: productListRef.current.querySelector('.product-list-content'),
                lerp: 0.1,
                smoothWheel: true,
            });

            // Animation frame for Lenis
            const raf = (time) => {
                if (lenisRef.current) {
                    lenisRef.current.raf(time);
                    rafIdRef.current = requestAnimationFrame(raf);
                }
            };
            rafIdRef.current = requestAnimationFrame(raf);
        }

        return () => {
            // Cancel requestAnimationFrame
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }

            // Resume global Lenis and destroy product list Lenis
            if (globalLenis?.current) {
                globalLenis.current.start();
            }
            if (lenisRef.current) {
                lenisRef.current.destroy();
                lenisRef.current = null;
            }
        };
    }, [globalLenis]);

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
            <div className="relative top-0">
                <div className="absolute top-0 z-[100] inset-x-0 bg-black gap-4 left-1/2  -translate-x-1/2 w-[90%] md:w-1/2 md:min-w-[550px] max-w-[750px] flex flex-col items-center mt-3 mb-8 md:my-6">
                    {/* Search Input - Sticky */}
                    <div className="w-full bg-gray-700 sticky top-0 z-20 rounded-md ">
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

                    {/* Scrollable Product List with Lenis */}
                    <div ref={productListRef} className="w-full bg-gray-700 rounded-md h-[85vh] mb-20 sm:mb-12 overflow-hidden">
                        <div className="product-list-content flex flex-col gap-3 px-4 pb-4">
                            <div className="bg-gray-800 w-min whitespace-pre relative font-bold rounded-br-xl -left-4 mb-2 py-2 px-4">
                                <div>Custom Products</div>
                            </div>
                            {products.map(product => (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCheckboxChange(product.id, token);
                                    }}
                                    key={product.id}
                                    className={`border cursor-pointer px-4 py-3 rounded-md bg-gray-900 hover:bg-gray-800 duration-200 ease-linear tranisition-colors text-white flex items-center justify-between gap-2 ${allLinkedProducts?.some(p => p.ID === product.id) ? 'border-primary' : ''}`}
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
                                    <div className={`flex items-center transition-opacity duration-300 gap-2 ${allLinkedProducts?.some(p => p.ID === product.id) ? 'opacity-100' : 'opacity-0'}`}>
                                        <CloseIcon className="w-6 h-6 text-red-500 hover:text-white transition-colors duration-200 cursor-pointer" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="fixed bottom-4  sm:hidden w-full  mx-auto justify-center flex gap-2  opacity-0 z-[100] close-product-overlay-btn">
                    <Button
                        cta="Close Products List"
                        color="#82181a"
                        hover="inwards"
                        action="close-product-overlay"
                        overrideDefaultClasses="bg-red-500  whitespace-nowrap text-black text-sm md:text-base"
                        light={true}
                        setProductOverlay={() => {
                            document.body.style.overflow = 'auto';
                            setProductOverlay(false);
                        }}
                    />
                </div>
            </div>
        </div >
    );
}