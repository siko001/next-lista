'use client'
import SettingsIcon from "../svgs/SettingsIcon"
import SearchIcon from "../svgs/SearchIcon"
import Progressbar from "./Progressbar"
import { useListContext } from "../../contexts/ListContext"
import { decryptToken } from "../../lib/helpers"
import { useState, useEffect, useRef } from "react"
import { gsap } from "gsap"


// Icons
import ShareIcon from "../svgs/ShareIcon"
import RenameIcon from "../svgs/RenameIcon"
import TranshIcon from "../svgs/TranshIcon"
import CloseIcon from "../svgs/CloseIcon"
import ThrowIcon from "../svgs/ThrowIcon"
import { WP_API_BASE } from "../../lib/helpers"
import { set } from "react-hook-form"


export default function ShoppingListHeader({ setBaggedProductCount, setTotalProductCount, setProgress, progress, list, token, setShareDialogOpen, setAllLinkedProducts, allLinkedProducts, setCheckedProducts, checkedProducts, setBaggedProducts, baggedProducts }) {
    const { handleRenameInput, handleRenameClick, listRenameRef, handleRenameList, listRename, setListRename, innerListRef, listName, startingValue } = useListContext();
    const [openSettings, setOpenSettings] = useState(false)
    const searchProductRef = useRef(null);
    const [searchValue, setSearchValue] = useState("");
    const [searchIsOpen, setSearchIsOpen] = useState(false)

    const handleInputChange = (e) => {
        setSearchValue(e.target.value);
    };

    const handleListSettings = () => {
        setOpenSettings((prev) => !prev)
    }


    useEffect(() => {
        // handle click outside of the settings menu
        const handleClickOutside = (e) => {
            if (openSettings && !e.target.closest(".relative")) {
                setOpenSettings(false)
            }
        }
        // esc key to close the settings menu
        const handleKeyDown = (e) => {
            if (openSettings && e.key === "Escape") {
                setOpenSettings(false)
            }
        }
        document.addEventListener("click", handleClickOutside)
        document.addEventListener("keydown", handleKeyDown)
        return () => {
            document.removeEventListener("click", handleClickOutside)
            document.removeEventListener("keydown", handleKeyDown)
        }

    })


    const handleSearchProduct = (e) => {
        e.stopPropagation();
        if (searchIsOpen) return;
        let windowWidth = window.innerWidth;
        let width = windowWidth < 768 ? 100 : 200; // if mobile width is 100px else 200px

        searchProductRef.current.parentElement.style.border = "1px solid #21ba9c";
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
                searchProductRef.current.parentElement.style.border = "1px solid transparent";
                setSearchIsOpen(false);
            },
        });
    };

    const handleCloseSearch = (e) => {
        e.stopPropagation();
        setSearchValue("");
        gsap.to(searchProductRef.current, {
            width: 0,
            duration: 0.3,
            ease: "power2.out",
            onComplete: () => {
                searchProductRef.current.parentElement.style.border = "1px solid transparent";
                setSearchIsOpen(false);
            },
        });
    };


    const handleEmptyList = async (id, token) => {

        if (confirm("Are you sure you want to empty this list?")) {
            const updateStates = async () => {
                setAllLinkedProducts([])
                setCheckedProducts([])
                setBaggedProducts([])
                setBaggedProductCount(0)
                setTotalProductCount(0)
                setProgress(0)
            }

            const baggedContainer = document.querySelector('.bagged-products-container');
            const checkedContainer = document.querySelector('.checked-products-container');

            if ((checkedContainer || baggedContainer)) {
                if (checkedContainer) {
                    gsap.to(checkedContainer.children, {
                        opacity: 0,
                        y: 60,
                        duration: 0.3,
                        backgroundColor: '#ff0000',
                        stagger: 0.05,
                        onComplete: () => updateStates()
                    });
                }
                if (baggedContainer) {
                    gsap.to(baggedContainer.children, {
                        opacity: 0,
                        y: 60,
                        duration: 0.3,
                        backgroundColor: '#ff0000',
                        stagger: 0.05,
                        onComplete: () => updateStates()
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
            })
            const data = await res.json()
            if (!data.success) {
                setAllLinkedProducts(allLinkedProducts)
                setCheckedProducts(checkedProducts)
                setBaggedProducts(baggedProducts)
                setProgress(progress)
            }
        }
    }

    const handleDeleteList = async (listId, token) => {
        // In deletion handler before redirect
        sessionStorage.setItem('pendingDeletion', JSON.stringify({
            listId,
            token,
            expires: Date.now() + 5000
        }));

        // Redirect to clean URL
        window.location.href = '/';
    }



    return (
        <div className="w-full  flex flex-col gap-6  rounded-b-3xl md:min-w-[550px] py-4 px-6 max-w-[750px]  bg-gray-900 h-[100px] mx-auto sticky top-0 z-40">
            {/* list name */}
            <div className="flex items-center justify-between gap-12 px-2">
                {listRename ?
                    (
                        <div className="relative w-full  flex gap-2 items-center">
                            {/* Renaming */}
                            <input
                                type="text"
                                ref={listRenameRef}

                                onChange={handleRenameInput}
                                defaultValue={innerListRef.current?.innerText}
                                onBlur={() => {
                                    handleRenameList(listRenameRef.current.value, token, "in-list")
                                    setListRename(false)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleRenameList(listRenameRef.current.value, token, "in-list")
                                        setListRename(false)
                                    }
                                }}
                                className="w-full dark:bg-gray-900 group-hover:bg-gray-200 dark:group-hover:bg-gray-800 bg-gray-100 transition-colors duration-100 max-w-[400px] rounded-sm pl-2 outline-none text-lg font-bold"
                                placeholder="List-A Name"
                            />

                            <div>
                                {/* quanity of words */}
                                <span className=" text-xs font-bold">{startingValue}/32</span>
                            </div>
                        </div>
                    )
                    :
                    (
                        <h2 ref={innerListRef} onClick={() => handleRenameClick(list.id)} className="text-xl md:text-2xl font-bold">
                            {listName || list?.title}
                        </h2>
                    )
                }

                <div className="flex gap-6 items-center">
                    <div
                        onClick={handleSearchProduct}
                        className="flex items-center gap-2 group relative"
                    >
                        <div className="flex items-center pr-1 relative overflow-hidden dark:bg-gray-900 group-hover:bg-gray-200 dark:group-hover:bg-gray-800 bg-gray-100 max-w-[400px]">
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
                        <SearchIcon className={`w-6 h-6 md:w-8 md:h-8 ${searchIsOpen ? "text-primary" : "dark:text-gray-600 text-gray-800 hover:text-gray-400"}  duration-200 transition-colors cursor-pointer`} />
                    </div>
                    <div onClick={handleListSettings} className="relative ">
                        {openSettings && (
                            <div className="absolute right-6 -top-2 mt-1  text-xs whitespace-nowrap py-1.5 px-1 shadow-[#00000055] rounded-sm bg-gray-200 dark:bg-gray-700 shadow-md z-30">
                                <div className="flex flex-col gap-0.5">
                                    <button onClick={() => handleRenameClick(list.id)} className=" cursor-pointer px-2 py-1 flex items-center hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors dark:text-white rounded-sm">
                                        <RenameIcon className="w-4 h-4 inline-block mr-1" />
                                        Rename
                                    </button>
                                    <button onClick={() => setShareDialogOpen(list.id)} className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm">
                                        <ShareIcon className="w-4 h-4 inline-block mr-1" />
                                        Share
                                    </button>
                                    <button onClick={() => handleEmptyList(list.id, token)} className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm">
                                        <ThrowIcon className="w-4 h-4 inline-block mr-1" />
                                        Empty
                                    </button>
                                    <button onClick={() => { handleDeleteList(list.id, token) }} className="px-2 py-1 cursor-pointer  hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors text-red-500 rounded-sm">
                                        <TranshIcon className="w-4 h-4 inline-block mr-1" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        )}
                        <SettingsIcon className={`w-6 h-6 md:w-8 md:h-8 ${openSettings ? "text-primary" : "dark:text-gray-600 text-gray-800 hover:text-gray-400"}  duration-200 transition-colors cursor-pointer`} />
                    </div>
                </div>
            </div>
            <Progressbar progress={progress} />
        </div>
    )
}