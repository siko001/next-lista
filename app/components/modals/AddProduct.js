'use client'
import Button from '../../components/Button';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import SearchIcon from '../svgs/SearchIcon';
import { decryptToken } from '../../lib/helpers';
import "../../css/checkbox.css";
import CloseIcon from '../svgs/CloseIcon';
import { useParams } from 'next/navigation';

export default function AddProduct({ setProductOverlay, token, checkedProducts, setCheckedProducts, allProducts }) {
    const [products, setProducts] = useState(allProducts);
    const [originalProducts] = useState(allProducts);

    const { searchRef } = useRef();
    const shoppingListId = useParams().id;
    const WP_API_BASE = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';

    const updateProductInShoppingList = async (productId, isAdding, token) => {
        if (!shoppingListId || !token) return;
        const decryptedToken = decryptToken(token);

        try {
            const response = await fetch(`${WP_API_BASE}/custom/v1/update-shopping-list`, {
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

            if (!response.ok) {
                throw new Error('Failed to update shopping list');
            }

            const data = await response.json();

            // Update to handle the new structure - map to just IDs if needed
            // Either keep the full objects or just the IDs depending on your needs
            setCheckedProducts(data.linkedProducts); // Use the full objects from backend

        } catch (error) {
            // console.error('Error:', error);
        }
    };

    // Modify the checkbox change handler
    const handleCheckboxChange = (productId, token) => {
        const isCurrentlyChecked = checkedProducts.some(product => product.id === productId);
        updateProductInShoppingList(productId, !isCurrentlyChecked, token);
    };

    // Modify the remove product handler
    const handleRemoveProduct = (e, productId) => {
        e.stopPropagation(); // Prevent triggering the parent click
        setCheckedProducts(prev => prev.filter(product => product.id !== productId));
        updateProductInShoppingList(productId, false, token);
    };


    useEffect(() => {
        gsap.set(".close-product-overlay-btn", {
            y: 200,
            opacity: 1,
        })
        gsap.to(".close-product-overlay-btn", {
            y: 0,
            duration: 0.5,
            ease: "power2.out",
        })
    }, [])

    const handleSearchProduct = (e) => {
        const searchValue = e.target.value.toLowerCase();

        if (searchValue === '') {
            setProducts(originalProducts);
        } else {
            const filteredProducts = originalProducts.filter(product =>
                product.title.toLowerCase().includes(searchValue)
            );
            setProducts(filteredProducts);
        }
    };
    const handleClick = (e) => {
        // if the checkbox is already checked, do nothing
        if (e.target.closest('.checkbox-wrapper-28').querySelector('input[type="checkbox"]').checked) return;

        const checkbox = e.target.closest('.checkbox-wrapper-28').querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.click();
    }
    // handle esc key and outside click to close the overlay
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setProductOverlay(false);
            }
        };
        const handleOutsideClick = (event) => {
            if (event.target.classList.contains('close-product-overlay')) {
                setProductOverlay(false);
            }
        };

        window.addEventListener('click', handleOutsideClick);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('click', handleOutsideClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [setProductOverlay]);

    return (
        <div>
            <div className="fixed z-[99] inset-0 w-full h-full bg-[#000000cc] blur-sm close-product-overlay"></div>
            <div className="fixed z-[100] inset-0  gap-4  left-[50%] -translate-x-1/2 w-[90%]  md:w-1/2  md:min-w-[550px] max-w-[750px]  flex flex-col items-center mt-6 mb-8 md:my-12">

                {/* Search Input */}
                <div className="w-full bg-gray-700 flex items bg-gray-70 center rounded-md relative">
                    <input onChange={handleSearchProduct} ref={searchRef} placeholder='Search for a Product...' className="w-full rounded-md border-2 transition-colors duration-200 border-transparent focus:border-primary outline-0  placeholder:relative placeholder:top-0.5 placeholder:text-2xl md:placeholder:font-black h-full peer py-3 px-2 text-2xl pr-10 focus:pr-2"></input>
                    <div className="h-full absolute right-0 peer-focus:opacity-0 duration-200 transition-opacity  grid place-items-center mr-2">
                        <SearchIcon className={'w-8 h-8 text-white'} />
                    </div>
                </div>

                <div className="w-full bg-gray-700 h-full mb-14 rounded-md ">
                    <div className="flex flex-col gap-3 px-4 mt-4">
                        {/* Products list - modified to handle immediate updates */}
                        {products.map((product) => (
                            <div
                                onClick={() => handleCheckboxChange(product.id, token)}
                                key={product.id}
                                className={`border px-4 py-3 rounded-md bg-gray-800 text-white flex items-center justify-between gap-2 ${checkedProducts.some(p => p.id === product.id) ? 'border-primary' : ''}`} >
                                <div className="flex items-center gap-2 font-bold text-xl checkbox-wrapper-28">
                                    <div className="checkbox-wrapper-28">
                                        <input
                                            id={`checkbox-${product.id}`}
                                            type="checkbox"
                                            className="promoted-input-checkbox peer"
                                            checked={checkedProducts.some(p => p.id === product.id)}
                                            onChange={() => handleCheckboxChange(product.id, token)} />


                                        <label htmlFor={`checkbox-${product.id}`}></label>
                                        <svg onClick={handleClick} className="absolute -z-0">
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

                                <div onClick={(e) => handleRemoveProduct(e, product.id)} className={`flex items-center transition-opacity duration-300 gap-2 ${checkedProducts.some(p => p.id === product.id) ? 'opacity-100' : 'opacity-0'}`}>
                                    <CloseIcon className="w-6 h-6 text-red-500 hover:text-white tranisition-colors duration-200 cursor-pointer" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>


            </div >
            <div className="fixed bottom-8 left-[50%] translate-x-[-50%] opacity-0 z-[100] close-product-overlay-btn">
                <Button cta="Close Products List" color="#82181a" hover="inwards" action="close-product-overlay" overrideDefaultClasses={"bg-red-500 text-black text-sm md:text-base"} light={true} setProductOverlay={setProductOverlay} />
            </div>

        </div >
    )
}