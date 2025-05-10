'use client'
import { useParams } from 'next/navigation'
import { decryptToken, WP_API_BASE } from "../../lib/helpers";
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { set } from 'react-hook-form';
import CloseIcon from '../svgs/CloseIcon';
import { useNotificationContext } from '../../contexts/NotificationContext';

export default function Product({
    setTotalProductCount,
    baggedProductCount,
    setBaggedProductCount,
    progress,
    setAllLinkedProducts,
    product,
    token,
    isBagged,
    setCheckedProducts,
    setBaggedProducts,
    setProgress,
    totalProductCount,
}) {
    const shoppingListId = useParams().id;
    const itemRef = useRef(null);
    const animationRef = useRef(null);
    const { showNotification } = useNotificationContext();

    // Function to cleanup animations
    const killAnimation = () => {
        if (animationRef.current) {
            animationRef.current.kill();
            animationRef.current = null;
        }
    };

    const updateProductStatus = async (action) => {
        if (!shoppingListId || !token) return;
        const decryptedToken = decryptToken(token);

        // Update local state based on action
        if (action === 'bag') {
            // Remove from checked, add to bagged
            setCheckedProducts(prev => prev.filter(p => p.id !== product.id));
            setBaggedProducts(prev => [...prev, product]);
            setBaggedProductCount(prev => prev + 1);
            setProgress((prev) => {
                const newProgress = prev + (1 / totalProductCount) * 100;
                return newProgress > 100 ? 100 : newProgress;
            });
        } else {
            // Remove from bagged, add back to checked
            setBaggedProducts(prev => prev.filter(p => p.id !== product.id));
            setCheckedProducts(prev => [...prev, product]);
            setBaggedProductCount(prev => prev - 1);
            setProgress((prev) => {
                const newProgress = prev - (1 / totalProductCount) * 100;
                return newProgress < 0 ? 0 : newProgress;
            });
        }

        try {
            const response = await fetch(`${WP_API_BASE}/custom/v1/update-shopping-list`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${decryptedToken}`
                },
                body: JSON.stringify({
                    shoppingListId,
                    productId: product.id,
                    action // 'bag' or 'unbag'
                }),
            });

            const data = await response.json();

            if (data.error) {
                // Handle error
                if (action === 'bag') {
                    setCheckedProducts(prev => [...prev, product]);
                    setBaggedProducts(prev => prev.filter(p => p.id !== product.id));
                    setProgress((prev) => {
                        const newProgress = prev - (1 / totalProductCount) * 100;
                        return newProgress < 0 ? 0 : newProgress;
                    });
                } else {
                    setBaggedProducts(prev => [...prev, product]);
                    setCheckedProducts(prev => prev.filter(p => p.id !== product.id));
                    setProgress((prev) => {
                        const newProgress = prev + (1 / totalProductCount) * 100;
                        return newProgress > 100 ? 100 : newProgress;
                    });
                }
            }
            return data;

        } catch (error) {
            console.error('Error:', error);
            // revert local state changes if API call fails
            if (action === 'bag') {
                setCheckedProducts(prev => [...prev, product]);
                setBaggedProducts(prev => prev.filter(p => p.id !== product.id));
                setProgress((prev) => {
                    const newProgress = prev - (1 / totalProductCount) * 100;
                    return newProgress < 0 ? 0 : newProgress;
                });
            } else {
                setBaggedProducts(prev => [...prev, product]);
                setCheckedProducts(prev => prev.filter(p => p.id !== product.id));
                setProgress((prev) => {
                    const newProgress = prev + (1 / totalProductCount) * 100;
                    return newProgress > 100 ? 100 : newProgress;
                });
            }
        }
    };

    const animateToBagged = async () => {
        return new Promise((resolve) => {
            killAnimation();
            animationRef.current = gsap.to(itemRef.current, {
                scale: 1.1,
                duration: 0.2,
                onComplete: () => {
                    animationRef.current = gsap.to(itemRef.current, {
                        backgroundColor: '#14532d', // Green background
                        duration: 0.2,
                        onComplete: () => {
                            animationRef.current = gsap.to(itemRef.current, {
                                y: 20,
                                opacity: 0,
                                duration: 0.3,
                                onComplete: () => {
                                    animationRef.current = null;
                                    gsap.set(itemRef.current, { clearProps: 'all' });
                                    resolve();
                                },
                            });
                        },
                    });
                },
            });
        });
    };

    const animateToChecked = async () => {
        return new Promise((resolve) => {
            killAnimation();
            animationRef.current = gsap.to(itemRef.current, {
                scale: 1.1,
                duration: 0.2,
                onComplete: () => {
                    animationRef.current = gsap.to(itemRef.current, {
                        backgroundColor: '#1f2937', // Gray background
                        duration: 0.2,
                        onComplete: () => {
                            animationRef.current = gsap.to(itemRef.current, {
                                y: -20,
                                opacity: 0,
                                duration: 0.3,
                                onComplete: () => {
                                    animationRef.current = null;
                                    gsap.set(itemRef.current, { clearProps: 'all' });
                                    resolve();
                                },
                            });
                        },
                    });
                },
            });
        });
    };

    const animateAppearInBagged = () => {
        killAnimation();
        animationRef.current = gsap.fromTo(
            itemRef.current,
            { y: 20, opacity: 0 },
            {
                y: 0,
                opacity: 1,
                backgroundColor: '#14532d',
                duration: 0.4,
                onComplete: () => {
                    animationRef.current = null;
                    gsap.set(itemRef.current, { clearProps: 'backgroundColor' });
                },
            }
        );
    };

    const animateAppearInChecked = () => {
        killAnimation();
        animationRef.current = gsap.fromTo(
            itemRef.current,
            { y: -20, opacity: 0 },
            {
                y: 0,
                opacity: 1,
                backgroundColor: '#1f2937',
                duration: 0.4,
                onComplete: () => {
                    animationRef.current = null;
                    gsap.set(itemRef.current, { clearProps: 'backgroundColor' });
                },
            }
        );
    };

    const animateToRemove = async (productId) => {
        return new Promise((resolve) => {
            killAnimation();
            animationRef.current = gsap.to(itemRef.current, {
                scale: 1.1,
                duration: 0.2,
                onComplete: () => {
                    animationRef.current = gsap.to(itemRef.current, {
                        backgroundColor: '#dc2626', // Red background
                        duration: 0.2,
                        onComplete: () => {
                            showNotification('Product removed', 'success', 1200);
                            animationRef.current = gsap.to(itemRef.current, {
                                y: 40,
                                opacity: 0,
                                duration: 0.3,
                                onUpdate: function () {
                                    // Execute logic mid-animation (e.g., at 50% progress)
                                    const progress = this.progress(); // Get animation progress (0 to 1)
                                    if (progress >= 0.5 && !this.midActionExecuted) {
                                        this.midActionExecuted = true; // Ensure this logic runs only once
                                        // Perform mid-animation logic here
                                        // do somehting half way in the animation
                                        setBaggedProducts(prev => prev.filter(p => p.id !== productId));
                                        setAllLinkedProducts(prev => prev.filter(p => p.ID !== productId));
                                        setBaggedProductCount(prev => prev - 1);
                                        setTotalProductCount(prev => prev - 1);
                                        setProgress((prev) => {
                                            const newProgress = prev - (1 / totalProductCount) * 100;
                                            return newProgress < 0 ? 0 : newProgress;
                                        });
                                    }
                                },
                                onComplete: () => {

                                    animationRef.current = null;
                                    gsap.set(itemRef.current, { clearProps: 'all' });
                                    resolve();
                                },
                            });
                        },
                    });
                },
            });
        });
    };

    const handleClick = async () => {
        if (isBagged) {
            await animateToChecked();
            updateProductStatus('unbag');
            animateAppearInChecked();
        } else {
            await animateToBagged();
            updateProductStatus('bag');
            animateAppearInBagged();
        }
    };

    // remove from linked and bagged
    const handleRemoveSingleProduct = async () => {
        const decryptedToken = decryptToken(token);
        const productId = product.id;
        if (!shoppingListId || !token) return;
        // animate the removal
        await animateToRemove(productId);

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
                    action: 'remove'
                }),
            });
            await response.json();

        } catch (error) {

            console.error('Error:', error);
            setBaggedProducts(prev => [...prev, product]);
            setAllLinkedProducts(prev => [...prev, product]);
            setBaggedProductCount(prev => prev + 1);
            setTotalProductCount(prev => prev + 1);
            setProgress((prev) => {
                const newProgress = prev + (1 / totalProductCount) * 100;
                return newProgress > 100 ? 100 : newProgress;
            });
        }
    }



    return (
        <div onClick={(e) => { e.stopPropagation(); handleClick() }} ref={itemRef} className={`flex text-center transition-colors group duration-200  w-full mx-auto items-center justify-between gap-12 px-2 py-4 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer ${isBagged && 'border border-primary'}`} >
            <div
                className="flex items-center  w-full gap-4">
                <h3 className="max-[376px]:text-base text-lg md:text-xl font-semibold pl-3 flex gap-1 items-center">
                    <div className="checkbox-wrapper-28">
                        {/* Use a unique id for the checkbox */}
                        <input
                            id={`checkbox-${product.id}`}
                            type="checkbox"
                            className="promoted-input-checkbox"
                            checked={isBagged} // Synchronize with isBagged
                            onChange={handleClick} // Handle change event
                        />
                        <svg className="absolute -z-0">
                            <use href="#checkmark-28" />
                        </svg>
                        <label htmlFor={`checkbox-${product.id}`}></label>
                        <svg xmlns="http://www.w3.org/2000/svg">
                            <symbol id="checkmark-28" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeMiterlimit="10" fill="none" d="M22.9 3.7l-15.2 16.6-6.6-7.1" />
                            </symbol>
                        </svg>
                    </div>
                    {product.title}
                </h3>
            </div>
            {
                isBagged &&
                (
                    <CloseIcon onClick={(e, product) => {
                        e.stopPropagation();
                        handleRemoveSingleProduct(product)
                    }} className="group-hover:opacity-100 group-hover:visible mr-4 sm:invisible  sm:opacity-0 duration-200 transition-opcaity text-red-600 w-8 h-8" />
                )
            }
        </div>
    )
}
