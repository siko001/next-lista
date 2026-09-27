"use client";
import {useParams} from "next/navigation";
import {decryptToken, WP_API_BASE, decodeHtmlEntities} from "../../lib/helpers";
import {useRef} from "react";
import {animateProductExit} from "../../lib/productMotion";
import {Check, X} from "lucide-react";
import {useNotificationContext} from "../../contexts/NotificationContext";
import {invalidateCurrentLists} from "../../lib/dataCache.mjs";

export default function Product({
    setTotalProductCount,
    baggedProductCount,
    setBaggedProductCount,
    progress,
    setAllLinkedProducts,
    product,
    index = 0,
    token,
    isBagged,
    setCheckedProducts,
    setBaggedProducts,
    setProgress,
    totalProductCount,
}) {
    const shoppingListId = useParams().id;
    const itemRef = useRef(null);
    const isMovingRef = useRef(false);
    const {showNotification} = useNotificationContext();

    const updateProductStatus = async (action) => {
        if (!shoppingListId || !token) return;
        invalidateCurrentLists();
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
            if (response.ok && !data.error) invalidateCurrentLists();

            if (!response.ok || data.error) {
                // Handle error
                if (action === "bag") {
                    setCheckedProducts((prev) => [...prev, product]);
                    setBaggedProducts((prev) =>
                        prev.filter((p) => p.id !== product.id)
                    );
                    setBaggedProductCount((prev) => prev - 1);
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
                    setBaggedProductCount((prev) => prev + 1);
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
                setBaggedProductCount((prev) => prev - 1);
                setProgress((prev) => {
                    const newProgress = prev - (1 / totalProductCount) * 100;
                    return newProgress < 0 ? 0 : newProgress;
                });
            } else {
                setBaggedProducts((prev) => [...prev, product]);
                setCheckedProducts((prev) =>
                    prev.filter((p) => p.id !== product.id)
                );
                setBaggedProductCount((prev) => prev + 1);
                setProgress((prev) => {
                    const newProgress = prev + (1 / totalProductCount) * 100;
                    return newProgress > 100 ? 100 : newProgress;
                });
            }
        }
    };

    const animateOut = (direction) => animateProductExit([itemRef.current], direction);

    const handleClick = async () => {
        if (isMovingRef.current || !shoppingListId || !token) return;
        // Check if the product has a temporary ID (starts with 'temp-' or is a number that's too large to be a real ID)
        const isTemporaryProduct =
            typeof product.id === "string" && product.id.startsWith("temp-");

        if (isTemporaryProduct) {
            // Don't allow interaction with temporary products
            return;
        }

        isMovingRef.current = true;
        if (isBagged) {
            await animateOut(-1);
            void updateProductStatus("unbag");
        } else {
            await animateOut(1);
            void updateProductStatus("bag");
        }
    };

    // remove from linked and bagged
    const handleRemoveSingleProduct = async () => {
        if (isMovingRef.current || !shoppingListId || !token) return;
        invalidateCurrentLists();
        isMovingRef.current = true;
        const decryptedToken = decryptToken(token);
        const productId = product.id;
        await animateOut(1);
        setBaggedProducts((prev) => prev.filter((p) => p.id !== productId));
        setAllLinkedProducts((prev) =>
            prev.filter((p) => String(p.ID || p.id) !== String(productId))
        );
        setBaggedProductCount((prev) => prev - 1);
        setTotalProductCount((prev) => prev - 1);

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
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || "Removal failed");
            invalidateCurrentLists();
            showNotification("Product removed", "success", 1200);
        } catch (error) {
            console.error("Error:", error);
            setBaggedProducts((prev) => [...prev, product]);
            setAllLinkedProducts((prev) => [...prev, {...product, ID: productId}]);
            setBaggedProductCount((prev) => prev + 1);
            setTotalProductCount((prev) => prev + 1);
            showNotification("Could not remove product", "error", 1600);
        }
    };

    return (
        <div
            ref={itemRef}
            className={`list-product-row product-item ${isBagged ? "is-bagged bagged-product" : ""}`}
            style={{"--list-row-index": Math.min(index, 8)}}
        >
            <button
                type="button"
                onClick={handleClick}
                className="list-product-toggle"
                aria-label={`${isBagged ? "Move" : "Bag"} ${decodeHtmlEntities(product.title)}${isBagged ? " back to checklist" : ""}`}
                aria-pressed={isBagged}
            >
                <span className="list-product-check" aria-hidden="true">
                    {isBagged && <Check size={18} strokeWidth={3} />}
                </span>
                <span className="list-product-title">{decodeHtmlEntities(product.title)}</span>
                <span className="list-product-status">{isBagged ? "Bagged" : "To buy"}</span>
            </button>
            {isBagged && (
                <button
                    type="button"
                    onClick={handleRemoveSingleProduct}
                    className="list-product-remove"
                    aria-label={`Remove ${decodeHtmlEntities(product.title)} from list`}
                    title="Remove from list"
                >
                    <X size={18} aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
