"use client";
import {useEffect, useState} from "react";
import Link from "next/link";
import SettingsIcon from "../svgs/SettingsIcon";
import Progressbar from "./Progressbar";
import {
    decodeHtmlEntities,
    calculateProgress,
    isListOwner,
} from "../../lib/helpers";
import {setCookie} from "cookies-next";
import {useUserContext} from "../../contexts/UserContext";
import {getListMetadata} from "../../actions/listActions";

// Contexts
import {useListContext} from "../../contexts/ListContext";

export default function List({
    listSettings,
    list,
    provided,
    snapshot,
    handleListSettings,
    handleRenameList,
    token,
    decoy,
}) {
    const {
        listRenameRef,
        setStartingValue,
        listRename,
        setListRename,
        handleRenameInput,
        startingValue,
    } = useListContext();
    const {userData} = useUserContext();
    const [listMetadata, setListMetadata] = useState(null);

    useEffect(() => {
        if (list && userData?.id) {
            getListMetadata(list, userData.id).then((metadata) => {
                setListMetadata(metadata);
            });
        }
    }, [list, userData?.id]);

    const handleGoToList = (e) => {
        e.stopPropagation();
        const listId = list.id;
        // set a cookie with the list id
        setCookie("listId", listId, {
            // httpOnly: true, // Prevent client-side access
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict", // Prevent CSRF attacks
            maxAge: 60 * 60 * 24 * 7, // 1 week
        });
        window.location.href = `/list/${listId}`;
    };

    const progress = calculateProgress(
        list?.acf?.product_count,
        list?.acf?.bagged_product_count
    );

    return (
        <div
            onClick={handleGoToList}
            id={`list-${list.id}`}
            ref={provided?.innerRef}
            {...(provided?.draggableProps || {})}
            {...(provided?.dragHandleProps || {})}
            className={`shoppinglist-item ${
                list.isNew ? "new-list" : ""
            } focus:border-primary outline-0  transition-colors hover:shadow-[#00000033] dark:shadow-[#ffffff02] hover:dark:shadow-[#ffffff05] hover:scale-[102%] flex flex-col gap-2 border hover:border-blue-600 dark:hover:border-blue-800  px-6 py-3 2xl:px-8 2xl:py-4 rounded-lg shadow-xl shadow-[#00000022] dark:bg-black bg-white min-w-full w-full md:min-w-[550px] lg:min-w-[850px] 2xl:min-w-[950px]  duration-200 hover:dark:bg-gray-950 hover:bg-gray-100 mx-auto relative ${
                snapshot?.isDragging
                    ? "!scale-90 dark:!bg-gray-900 border-blue-800 !bg-gray-100 md:scale-110 !left-0 md:!left-[50%] md:!-translate-x-[50%]"
                    : "scale-100 "
            }`}
            style={{
                touchAction: "none",
                ...(provided?.draggableProps?.style || {}),
            }}
        >
            <div className="flex justify-between w-full gap-3 shopping-list">
                {listRename && listRename === list.id ? (
                    <div className="relative w-full  flex gap-2 items-center relative">
                        {/* Renaming */}
                        <input
                            type="text"
                            ref={listRenameRef}
                            className="w-full dark:bg-gray-900 group-hover:bg-gray-200 dark:group-hover:bg-gray-800 bg-gray-100 transition-colors duration-100 max-w-[400px] rounded-sm pl-2 outline-none text-lg font-bold"
                            defaultValue={list.title}
                            onBlur={(e) => {
                                e.stopPropagation();
                                setListRename(false);
                                handleRenameList(e.target.value, token);
                            }}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") {
                                    setListRename(false);
                                    handleRenameList(e.target.value, token);
                                }
                            }}
                            onChange={handleRenameInput}
                        />
                        <div>
                            {/* quanity of words */}
                            <span className=" text-xs font-bold">
                                {startingValue}/32
                            </span>
                        </div>
                    </div>
                ) : (
                    // No Renaming
                    <p
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRenameList(list.id);
                            setListRename(list.id);
                            setTimeout(() => {
                                listRenameRef.current.focus();
                                setStartingValue(
                                    listRenameRef.current.value.length
                                );
                            }, 0);
                        }}
                        className="font-bold text-sm md:text-lg whitespace-normal break-all"
                    >
                        {decodeHtmlEntities(list.title)}
                    </p>
                )}

                {listMetadata && !listMetadata.isOwner && (
                    <div
                        className={`absolute z-0 left-6 top-8 sm:top-9 w-full h-full text-[8px] whitespace-nowrap ${
                            listRename === list.id ? "hidden" : ""
                        }`}
                    >
                        Owned by: {listMetadata.ownerName}
                    </div>
                )}

                <div className="flex items-center gap-2 justify-between ">
                    <div className="text-xs md:text-base 2xl:text-lg font-bold whitespace-pre text-gray-600 dark:text-gray-400 relative top-[1px]">
                        {list?.acf?.product_count &&
                            list?.acf?.product_count != 0 &&
                            `${list?.acf?.bagged_product_count || 0} / ${
                                list?.acf?.product_count
                            }`}
                    </div>

                    {/* List Actions Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleListSettings(list.id);
                        }}
                        className="relative !z-[9999]"
                    >
                        <SettingsIcon
                            className={`w-6 h-6 settings-icon ${
                                listSettings === list.id
                                    ? "text-primary"
                                    : "dark:text-gray-600 text-gray-800 hover:text-gray-400"
                            }  duration-200 transition-colors  cursor-pointer`}
                        />
                    </button>
                </div>
            </div>

            <Progressbar progress={progress} />
        </div>
    );
}
