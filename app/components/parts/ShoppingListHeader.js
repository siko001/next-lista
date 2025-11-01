"use client";
import {useState, useEffect, useRef} from "react";
import {gsap} from "gsap";
import {
    decryptToken,
    WP_API_BASE,
    isListOwner,
    decodeHtmlEntities,
} from "../../lib/helpers";

// Contexts
import {useOverlayContext} from "../../contexts/OverlayContext";
import {useListContext} from "../../contexts/ListContext";
import {useNotificationContext} from "../../contexts/NotificationContext";

// Components
import Overlay from "../../components/modals/Overlay";
import Progressbar from "./Progressbar";

// Icons
import ShareIcon from "../svgs/ShareIcon";
import RenameIcon from "../svgs/RenameIcon";
import TranshIcon from "../svgs/TranshIcon";
import CloseIcon from "../svgs/CloseIcon";
import ThrowIcon from "../svgs/ThrowIcon";
import SettingsIcon from "../svgs/SettingsIcon";
import SearchIcon from "../svgs/SearchIcon";

export default function ShoppingListHeader({
    ownerName,
    title,
    totalProductCount,
    handleSearchProducts,
    setBaggedProductCount,
    setTotalProductCount,
    setProgress,
    progress,
    list,
    userId,
    token,
    setShareDialogOpen,
    setAllLinkedProducts,
    allLinkedProducts,
    setCheckedProducts,
    checkedProducts,
    setBaggedProducts,
    baggedProducts,
}) {
    const {
        handleRenameInput,
        handleRenameClick,
        listRenameRef,
        handleRenameList,
        listRename,
        setListRename,
        innerListRef,
        listName,
        startingValue,
    } = useListContext();
    const [openSettings, setOpenSettings] = useState(false);
    const searchProductRef = useRef(null);
    const [searchValue, setSearchValue] = useState("");
    const [searchIsOpen, setSearchIsOpen] = useState(false);
    const {overlay, showVerbConfirmation} = useOverlayContext();
    const {showNotification} = useNotificationContext();
    const [originalCheckedLength, setOriginalCheckedLength] = useState(
        checkedProducts?.length || 0
    );
    const [originalBaggedLength, setOriginalBaggedLength] = useState(
        baggedProducts?.length || 0
    );

    useEffect(() => {
        if (!searchIsOpen) {
            setOriginalCheckedLength(checkedProducts?.length || 0);
            setOriginalBaggedLength(baggedProducts?.length || 0);
        }
    }, [checkedProducts?.length, baggedProducts?.length, searchIsOpen]);

    const handleInputChange = (e) => {
        setSearchValue(e.target.value);
        handleSearchProducts(e.target.value);
    };

    const handleListSettings = () => {
        if (openSettings) {
            const el = document.querySelector("#header-settings-menu");
            if (el) {
                gsap.killTweensOf(el);
                const h = el.scrollHeight;
                gsap.set(el, {height: h, overflow: "hidden"});
                gsap.to(el, {
                    height: 0,
                    opacity: 0,
                    y: -6,
                    duration: 0.3,
                    ease: "power2.in",
                    onComplete: () => setOpenSettings(false),
                });
                return;
            }
        }
        setOpenSettings((prev) => !prev);
    };

    useEffect(() => {
        // handle click outside of the settings menu with animated close
        const handleClickOutside = (e) => {
            if (e.target.closest(".shopping-list-header-settings") === null) {
                if (openSettings) {
                    const el = document.querySelector("#header-settings-menu");
                    if (el) {
                        gsap.killTweensOf(el);
                        const h = el.scrollHeight;
                        gsap.set(el, {height: h, overflow: "hidden"});
                        gsap.to(el, {
                            height: 0,
                            opacity: 0,
                            y: -6,
                            duration: 0.3,
                            ease: "power2.in",
                            onComplete: () => setOpenSettings(false),
                        });
                        return;
                    }
                }
                setOpenSettings(false);
            }
        };
        // esc key to close the settings menu
        const handleKeyDown = (e) => {
            if (openSettings && e.key === "Escape") {
                const el = document.querySelector("#header-settings-menu");
                if (el) {
                    gsap.killTweensOf(el);
                    const h = el.scrollHeight;
                    gsap.set(el, {height: h, overflow: "hidden"});
                    gsap.to(el, {
                        height: 0,
                        opacity: 0,
                        y: -6,
                        duration: 0.3,
                        ease: "power2.in",
                        onComplete: () => setOpenSettings(false),
                    });
                    return;
                }
                setOpenSettings(false);
            }
        };
        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("click", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [openSettings]);

    // Animate open when toggled on
    useEffect(() => {
        if (!openSettings) return;
        const el = document.querySelector("#header-settings-menu");
        if (!el) return;
        gsap.killTweensOf(el);
        gsap.set(el, {height: 0, opacity: 0, y: -6, overflow: "hidden"});
        gsap.to(el, {
            height: "auto",
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: "power2.out",
            onComplete: () => gsap.set(el, {clearProps: "height"}),
        });
    }, [openSettings]);

    const handleSearchProduct = (e) => {
        e.stopPropagation();
        if (searchIsOpen) return;
        let windowWidth = window.innerWidth;
        let width = windowWidth < 768 ? 100 : 200; // if mobile width is 100px else 200px

        searchProductRef.current.parentElement.style.border =
            "1px solid #21ba9c";
        searchProductRef.current.focus();
        gsap.to(searchProductRef.current, {
            width: width,
            duration: 0.3,
            ease: "power2.out",
            onStart: () => {
                setSearchIsOpen(true);
            },
        });
    };

    const handleBlurSearchProduct = () => {
        if (!searchIsOpen) return;
        if (searchProductRef.current.value) return;

        gsap.to(searchProductRef.current, {
            width: 0,
            duration: 0.3,
            ease: "power2.out",
            onComplete: () => {
                searchProductRef.current.parentElement.style.border =
                    "1px solid transparent";
                setSearchIsOpen(false);
            },
        });
    };

    const handleCloseSearch = (e) => {
        e.stopPropagation();
        setSearchValue("");
        handleSearchProducts(""); // Clear the search and restore original products
        gsap.to(searchProductRef.current, {
            width: 0,
            duration: 0.3,
            ease: "power2.out",
            onComplete: () => {
                searchProductRef.current.parentElement.style.border =
                    "1px solid transparent";
                setSearchIsOpen(false);
            },
        });
    };

    const handleEmptyList = async (id, token) => {
        if (!id || !token) return;
        const updateStates = async () => {
            setAllLinkedProducts([]);
            setCheckedProducts([]);
            setBaggedProducts([]);
            setBaggedProductCount(0);
            setTotalProductCount(0);
            setProgress(0);
            showNotification("List emptied successfully", "success", 1000);
        };

        const baggedContainer = document.querySelector(
            ".bagged-products-container"
        );
        const checkedContainer = document.querySelector(
            ".checked-products-container"
        );

        if (checkedContainer || baggedContainer) {
            if (checkedContainer) {
                gsap.to(checkedContainer.children, {
                    opacity: 0,
                    y: 60,
                    duration: 0.3,
                    backgroundColor: "#ff0000",
                    stagger: 0.05,
                    onComplete: () => updateStates(),
                });
            }
            if (baggedContainer) {
                gsap.to(baggedContainer.children, {
                    opacity: 0,
                    y: 60,
                    duration: 0.3,
                    backgroundColor: "#ff0000",
                    stagger: 0.05,
                    onComplete: () => updateStates(),
                });
            }
        } else {
            updateStates();
        }

        const decryptedToken = decryptToken(token);
        const res = await fetch(`${WP_API_BASE}/custom/v1/empty/${id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${decryptedToken}`,
            },
            shoppingListId: id,
        });
        const data = await res.json();

        if (!data.success || data.code == "jwt_auth_invalid_token") {
            setAllLinkedProducts(allLinkedProducts);
            setCheckedProducts(checkedProducts);
            setBaggedProducts(baggedProducts);
            setProgress(progress);
        }
    };

    const handleDeleteList = async (listId, token) => {
        // In deletion handler before redirect
        sessionStorage.setItem(
            "pendingDeletion",
            JSON.stringify({
                listId,
                token,
                expires: Date.now() + 5000,
            })
        );

        // Redirect to clean URL
        window.location.href = "/";
    };

    return (
        <>
            <div
                className={`w-full  flex flex-col ${
                    isListOwner(list, userId) ? "gap-6" : "gap-2"
                }  rounded-b-3xl md:min-w-[550px] py-4 px-6 max-w-[750px] border dark:border-transparent shopping-list-header min-h-[100px] md:h-[100px] mx-auto sticky top-0 z-40`}
            >
                {/* list name */}
                <div className="flex items-center justify-between  px-2">
                    {listRename ? (
                        <div className="relative w-full  flex gap-2 items-center">
                            {/* Renaming */}
                            <input
                                type="text"
                                ref={listRenameRef}
                                onChange={handleRenameInput}
                                defaultValue={innerListRef.current?.innerText}
                                onBlur={() => {
                                    handleRenameList(
                                        listRenameRef.current.value,
                                        token,
                                        "in-list"
                                    );
                                    setListRename(false);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleRenameList(
                                            listRenameRef.current.value,
                                            token,
                                            "in-list"
                                        );
                                        setListRename(false);
                                    }
                                }}
                                className="w-full dark:bg-gray-900 group-hover:bg-gray-200 dark:group-hover:bg-gray-800 bg-gray-100 transition-colors duration-100 max-w-[400px] rounded-sm pl-2 outline-none text-lg font-bold"
                                placeholder="List-A Name"
                            />

                            <div>
                                {/* quanity of words */}
                                <span className=" text-xs font-bold">
                                    {startingValue}/32
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col top-2 -left-2 relative">
                            <h2
                                ref={innerListRef}
                                onClick={() => handleRenameClick(list.id)}
                                className="text-xl  max-w-[80ch]  whitespace-normal overflow-scroll md:text-2xl font-bold "
                            >
                                {decodeHtmlEntities(
                                    listName || title || list?.title
                                )}
                            </h2>

                            {!isListOwner(list, userId) && (
                                <div className="relative -top-1 w-full h-full h-0 text-[10px] whitespace-nowrap">
                                    Owned by: {ownerName}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-6 items-center">
                        {(originalCheckedLength > 0 ||
                            originalBaggedLength > 0) && (
                            <div
                                onClick={handleSearchProduct}
                                className="flex items-center gap-2 group relative"
                            >
                                {/*  dark:bg-gray-900 group-hover:bg-gray-100 dark:group-hover:bg-gray-800 bg-gray-200 */}
                                <div className="flex items-center pr-1 relative overflow-hidden max-w-[400px]">
                                    <input
                                        ref={searchProductRef}
                                        type="text"
                                        placeholder="Search"
                                        value={searchValue}
                                        onChange={handleInputChange}
                                        onBlur={handleBlurSearchProduct}
                                        className="w-0 transition-all !outline-0 !border-0 peer duration-700 pl-2 outline-none text-lg font-bold"
                                    />
                                    {searchValue && (
                                        <CloseIcon
                                            onClick={handleCloseSearch}
                                            className="w-6 h-6 dark:text-gray-600 text-gray-800 hover:text-red-500 duration-200 transition-colors cursor-pointer"
                                        />
                                    )}
                                </div>
                                <SearchIcon
                                    className={`w-6 h-6 md:w-8 md:h-8 ${
                                        searchIsOpen
                                            ? "text-primary"
                                            : "dark:text-gray-600 text-gray-800 hover:text-gray-400"
                                    }  duration-200 transition-colors cursor-pointer`}
                                />
                            </div>
                        )}
                        <div
                            onClick={handleListSettings}
                            className="relative shopping-list-header-settings"
                        >
                            {openSettings && (
                                <div
                                    id="header-settings-menu"
                                    className="absolute right-6 -top-2 mt-1  text-xs whitespace-nowrap py-1.5 px-1 shadow-[#00000055] rounded-sm tools shadow-md z-30 overflow-hidden"
                                >
                                    <div className="flex flex-col gap-0.5 font-quicksand font-[500]">
                                        <button
                                            onClick={() =>
                                                handleRenameClick(list.id)
                                            }
                                            className=" cursor-pointer px-2 py-1 flex items-center tool  text-left duration-200 transition-colors dark:text-white rounded-sm"
                                        >
                                            <RenameIcon className="w-4 h-4 inline-block mr-1" />
                                            Rename
                                        </button>
                                        <button
                                            onClick={() =>
                                                setShareDialogOpen(list.id)
                                            }
                                            className="px-2 py-1 tool cursor-pointer tool  text-left duration-200 transition-colors dark:text-white rounded-sm"
                                        >
                                            <ShareIcon className="w-4 h-4 inline-block mr-1" />
                                            Share
                                        </button>
                                        {totalProductCount > 0 && (
                                            <button
                                                onClick={() =>
                                                    totalProductCount > 0 &&
                                                    showVerbConfirmation(
                                                        list,
                                                        token,
                                                        "Empty"
                                                    )
                                                }
                                                className="px-2 py-1 tool cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm"
                                            >
                                                <ThrowIcon className="w-4 h-4 inline-block mr-1" />
                                                Empty
                                            </button>
                                        )}

                                        {/* Only the list owner can delete the list */}
                                        {isListOwner(list, userId) && (
                                            <button
                                                onClick={() =>
                                                    showVerbConfirmation(
                                                        list,
                                                        token,
                                                        "Delete"
                                                    )
                                                }
                                                className="px-2 py-1 cursor-pointer tool-danger  text-red-500 text-left duration-200 transition-colors text-red-500 rounded-sm"
                                            >
                                                <TranshIcon className="w-4 h-4 inline-block mr-1" />
                                                Delete
                                            </button>
                                        )}

                                        {/* The user can remove themselves from the list */}
                                        {!isListOwner(list, userId) && (
                                            <button
                                                onClick={() =>
                                                    showVerbConfirmation(
                                                        list,
                                                        token,
                                                        "Remove",
                                                        userId
                                                    )
                                                }
                                                className="px-2 py-1 cursor-pointer tools tools-danger text-left duration-200 transition-colors text-red-600 rounded-sm"
                                            >
                                                <TranshIcon className="w-4 h-4 inline-block mr-1" />
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            <SettingsIcon
                                className={`w-6 h-6 md:w-8 md:h-8 ${
                                    openSettings
                                        ? "text-primary"
                                        : "dark:text-gray-600 text-gray-800 hover:text-gray-400"
                                }  duration-200 transition-colors cursor-pointer`}
                            />
                        </div>
                    </div>
                </div>
                <Progressbar progress={progress} />
            </div>

            {overlay && (
                <Overlay
                    handleEmptyList={handleEmptyList}
                    handleDeleteList={handleDeleteList}
                />
            )}
        </>
    );
}
