"use client";
import {useParams} from "next/navigation";
import {decryptToken, WP_API_BASE, decodeHtmlEntities} from "../../lib/helpers";
import {useRef, useEffect} from "react";
import gsap from "gsap";
import {set} from "react-hook-form";
import CloseIcon from "../svgs/CloseIcon";
import {useNotificationContext} from "../../contexts/NotificationContext";

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
    const {showNotification} = useNotificationContext();

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
        if (action === "bag") {
            // Remove from checked, add to bagged
            setCheckedProducts((prev) =>
                prev.filter((p) => p.id !== product.id)
            );
            setBaggedProducts((prev) => [...prev, product]);
            setBaggedProductCount((prev) => prev + 1);
            setProgress((prev) => {
                const newProgress = prev + (1 / totalProductCount) * 100;
                return newProgress > 100 ? 100 : newProgress;
            });
        } else {
            // Remove from bagged, add back to checked
            setBaggedProducts((prev) =>
                prev.filter((p) => p.id !== product.id)
            );
            setCheckedProducts((prev) => [...prev, product]);
            setBaggedProductCount((prev) => prev - 1);
            setProgress((prev) => {
                const newProgress = prev - (1 / totalProductCount) * 100;
                return newProgress < 0 ? 0 : newProgress;
            });
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
                        productId: product.id,
                        action, // 'bag' or 'unbag'
                    }),
                }
            );

            const data = await response.json();

            if (data.error) {
                // Handle error
                if (action === "bag") {
                    setCheckedProducts((prev) => [...prev, product]);
                    setBaggedProducts((prev) =>
                        prev.filter((p) => p.id !== product.id)
                    );
                    setProgress((prev) => {
                        const newProgress =
                            prev - (1 / totalProductCount) * 100;
                        return newProgress < 0 ? 0 : newProgress;
                    });
                } else {
                    setBaggedProducts((prev) => [...prev, product]);
                    setCheckedProducts((prev) =>
                        prev.filter((p) => p.id !== product.id)
                    );
                    setProgress((prev) => {
                        const newProgress =
                            prev + (1 / totalProductCount) * 100;
                        return newProgress > 100 ? 100 : newProgress;
                    });
                }
            }
            return data;
        } catch (error) {
            console.error("Error:", error);
            // revert local state changes if API call fails
            if (action === "bag") {
                setCheckedProducts((prev) => [...prev, product]);
                setBaggedProducts((prev) =>
                    prev.filter((p) => p.id !== product.id)
                );
                setProgress((prev) => {
                    const newProgress = prev - (1 / totalProductCount) * 100;
                    return newProgress < 0 ? 0 : newProgress;
                });
            } else {
                setBaggedProducts((prev) => [...prev, product]);
                setCheckedProducts((prev) =>
                    prev.filter((p) => p.id !== product.id)
                );
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
                scale: 1.06,
                duration: 0.15,
                onComplete: () => {
                    animationRef.current = gsap.to(itemRef.current, {
                        y: 20,
                        opacity: 0,
                        zIndex: 1,
                        duration: 0.22,
                        onComplete: () => {
                            animationRef.current = null;
                            gsap.set(itemRef.current, {clearProps: "all"});
                            resolve();
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
                scale: 1.06,
                duration: 0.15,
                onComplete: () => {
                    animationRef.current = gsap.to(itemRef.current, {
                        y: -20,
                        opacity: 0,
                        zIndex: 1,
                        duration: 0.22,
                        onComplete: () => {
                            animationRef.current = null;
                            gsap.set(itemRef.current, {clearProps: "all"});
                            resolve();
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
            {y: 20, opacity: 0},
            {
                y: 0,
                opacity: 1,
                backgroundColor: "#14532d",
                duration: 0.4,
                onComplete: () => {
                    animationRef.current = null;
                    gsap.set(itemRef.current, {clearProps: "backgroundColor"});
                },
            }
        );
    };

    const animateAppearInChecked = () => {
        killAnimation();
        animationRef.current = gsap.fromTo(
            itemRef.current,
            {y: -20, opacity: 0},
            {
                y: 0,
                opacity: 1,
                backgroundColor: "#1f2937",
                duration: 0.4,
                onComplete: () => {
                    animationRef.current = null;
                    gsap.set(itemRef.current, {clearProps: "backgroundColor"});
                },
            }
        );
    };

    const animateToRemove = async (productId) => {
        return new Promise((resolve) => {
            killAnimation();
            const el = itemRef.current;
            if (!el) return resolve();

            gsap.set(el, {zIndex: 2, willChange: "opacity,transform"});
            animationRef.current = gsap.to(el, {
                scale: 1.06,
                duration: 0.15,
                ease: "power1.out",
                onComplete: () => {
                    animationRef.current = gsap.to(el, {
                        y: 20,
                        opacity: 0,
                        duration: 0.22,
                        ease: "power1.inOut",
                        onComplete: () => {
                            // After visually gone, update state
                            showNotification(
                                "Product removed",
                                "success",
                                1200
                            );
                            setBaggedProducts((prev) =>
                                prev.filter((p) => p.id !== productId)
                            );
                            setAllLinkedProducts((prev) =>
                                prev.filter((p) => p.ID !== productId)
                            );
                            setBaggedProductCount((prev) => prev - 1);
                            setTotalProductCount((prev) => prev - 1);
                            setProgress((prev) => {
                                const newProgress =
                                    prev - (1 / totalProductCount) * 100;
                                return newProgress < 0 ? 0 : newProgress;
                            });

                            animationRef.current = null;
                            gsap.set(el, {clearProps: "all"});
                            resolve();
                        },
                    });
                },
            });
        });
    };

    const handleClick = async () => {
        if (isBagged) {
            await animateToChecked();
            updateProductStatus("unbag");
            animateAppearInChecked();
        } else {
            await animateToBagged();
            updateProductStatus("bag");
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
                        action: "remove",
                    }),
                }
            );
            await response.json();
        } catch (error) {
            console.error("Error:", error);
            setBaggedProducts((prev) => [...prev, product]);
            setAllLinkedProducts((prev) => [...prev, product]);
            setBaggedProductCount((prev) => prev + 1);
            setTotalProductCount((prev) => prev + 1);
            setProgress((prev) => {
                const newProgress = prev + (1 / totalProductCount) * 100;
                return newProgress > 100 ? 100 : newProgress;
            });
        }
    };

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                handleClick();
            }}
            ref={itemRef}
            className={`flex text-center transition-colors group duration-200  w-full mx-auto items-center product-item justify-between gap-12 px-2 py-4 border rounded-lg cursor-pointer ${
                isBagged && "border border-primary  bagged-product"
            }`}
        >
            <div className="flex items-center  w-full gap-4">
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
                                <path
                                    strokeLinecap="round"
                                    strokeMiterlimit="10"
                                    fill="none"
                                    d="M22.9 3.7l-15.2 16.6-6.6-7.1"
                                />
                            </symbol>
                        </svg>
                    </div>
                    {decodeHtmlEntities(product.title)}
                </h3>
            </div>
            {isBagged && (
                <CloseIcon
                    onClick={(e, product) => {
                        e.stopPropagation();
                        handleRemoveSingleProduct(product);
                    }}
                    className="group-hover:opacity-100 group-hover:visible mr-4 sm:invisible  sm:opacity-0 duration-200 transition-opcaity text-red-600 w-8 h-8"
                />
            )}
        </div>
    );
}
