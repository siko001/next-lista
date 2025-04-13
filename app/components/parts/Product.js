'use client'
import { useParams } from 'next/navigation'
import { decryptToken, WP_API_BASE } from "../../lib/helpers";
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { set } from 'react-hook-form';

export default function Product({
    setTotalProductCount, baggedProductCount, setBaggedProductCount, progress,
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


    return (
        <div
            ref={itemRef}
            onClick={handleClick}
            className={`flex text-center w-full mx-auto items-center justify-between gap-12 px-2 py-4 rounded-lg ${isBagged ? 'bg-green-900' : 'bg-gray-800 hover:bg-gray-700 cursor-pointer'
                }`}
        >
            <div className="flex items-center gap-4">
                <h3 className="text-lg md:text-xl font-semibold pl-3">
                    {product.title}
                </h3>
            </div>
        </div>
    )
}
