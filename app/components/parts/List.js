"use client";
import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import SettingsIcon from "../svgs/SettingsIcon";
import Progressbar from "./Progressbar";
import BinocularIcon from "../svgs/BinocularIcon";
import {
    decodeHtmlEntities,
    calculateProgress,
    isListOwner,
} from "../../lib/helpers";
import {setCookie} from "cookies-next";
import {useUserContext} from "../../contexts/UserContext";
import {getListMetadata} from "../../actions/listActions";
import {GripVertical, UserRound, UsersRound} from "lucide-react";

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
    userId,
    listsMetadata,
    onManageAccess,
}) {
    const {
        listRenameRef,
        setStartingValue,
        listRename,
        setListRename,
        handleRenameInput,
        startingValue,
        setListPreview,
    } = useListContext();
    const {userData} = useUserContext();
    const router = useRouter();

    // Prefer client user id when available, fallback to server-provided userId prop
    const effectiveUserId = (userData?.id ?? userId)?.toString();
    const isOwnerBasedOnId = list?.acf?.owner_id === effectiveUserId;
    const sharedCount = Array.isArray(list?.acf?.shared_with_users)
        ? list.acf.shared_with_users.length
        : 0;

    // Only use metadata for non-owners
    const metadata = !isOwnerBasedOnId
        ? listsMetadata[list.id] || {
              isOwner: false,
              ownerName: list?.acf?.owner_name || "",
              listId: list.id,
          }
        : {
              isOwner: true,
              ownerName: "",
              listId: list.id,
          };

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
        setListPreview(list);
        router.push(`/list/${listId}`);
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
            className={`shoppinglist-item home-list-card ${
                list.isNew ? "new-list" : ""
            } shopping-list-hover ${
                snapshot?.isDragging
                    ? "is-dragging drag"
                    : ""
            }`}
            style={{
                ...(provided?.draggableProps?.style || {}),
            }}
        >
            <div className="list-card-header shopping-list">
                <div className="list-card-title-group">
                    {listRename && listRename === list.id ? (
                        <div className="relative w-full flex gap-2 items-center relative">
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
                                onClick={(event) => event.stopPropagation()}
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
                        <div className="flex flex-col">
                            <button
                                type="button"
                                className="list-card-title"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setListRename(list.id);
                                    setTimeout(() => {
                                        listRenameRef.current?.focus();
                                        setStartingValue(listRenameRef.current?.value.length || 0);
                                    }, 0);
                                }}
                                title="Rename list"
                            >
                                {decodeHtmlEntities(list.title)}
                            </button>

                            {/* Only show owner name if we're definitely not the owner */}
                            {!isOwnerBasedOnId && metadata.ownerName && (
                                <div
                                    className={`list-card-owner ${
                                        listRename === list.id ? "hidden" : ""
                                    }`}
                                >
                                    <UserRound size={13} aria-hidden="true" />
                                    Owned by {metadata.ownerName}
                                </div>
                            )}
                            {isOwnerBasedOnId && sharedCount > 0 && onManageAccess && listRename !== list.id && (
                                <button
                                    type="button"
                                    className="list-card-shared"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onManageAccess(list);
                                    }}
                                    aria-label={`Manage access to ${decodeHtmlEntities(list.title)}, shared with ${sharedCount} ${sharedCount === 1 ? "person" : "people"}`}
                                >
                                    <UsersRound size={14} aria-hidden="true" />
                                    Shared with {sharedCount}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="list-card-actions">
                    <div className="list-card-count">
                        {list?.acf?.product_count > 0
                            ? `${list?.acf?.bagged_product_count || 0} / ${list?.acf?.product_count} bagged`
                            : "Empty list"}
                    </div>

                    {/* List Actions Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleListSettings(list.id);
                        }}
                        className="list-card-action"
                        aria-label={`Options for ${decodeHtmlEntities(list.title)}`}
                    >
                        <SettingsIcon
                            className={`w-6 h-6 settings-icon ${
                                listSettings === list.id
                                    ? "text-primary"
                                    : "dark:text-gray-600 text-gray-800 hover:text-gray-400"
                            }  duration-200 transition-colors  cursor-pointer`}
                        />
                    </button>
                    {provided?.dragHandleProps && (
                        <button
                            type="button"
                            {...provided.dragHandleProps}
                            onClick={(event) => event.stopPropagation()}
                            className="list-card-drag"
                            aria-label={`Drag ${decodeHtmlEntities(list.title)} to reorder`}
                            title="Drag to reorder"
                        >
                            <GripVertical size={20} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>

            <Progressbar progress={progress} />
        </div>
    );
}
