"use client";
import {useEffect, useState, useRef} from "react";
import {DragDropContext, Droppable, Draggable} from "@hello-pangea/dnd";
import {WP_API_BASE, isListOwner, removeListRelationship} from "./lib/helpers";
import {invalidateCurrentLists} from "./lib/dataCache.mjs";
import gsap from "gsap";
import {subscribePusherEvent} from "./lib/pusherClient";

// Websockets
import useUserListsRealtime from "./lib/UserListsRealTime";
import useRealtimeAllListDelete from "./lib/DeleteAllListRealtime";
import useSharedListsRealtime from "./lib/useSharedListsRealtime";

// Contexts
import {useUserContext} from "./contexts/UserContext";
import {useListContext} from "./contexts/ListContext";
import {useOverlayContext} from "./contexts/OverlayContext";
import {useLoadingContext} from "./contexts/LoadingContext";
import {useNotificationContext} from "./contexts/NotificationContext";

// Components
import Header from "./components/Header";
import Button from "./components/Button";
import Overlay from "./components/modals/Overlay";
import Notification from "./components/Notification";
import ShareListDialog from "./components/modals/ShareListDialog";

// Icons
import CopyIcon from "./components/svgs/CopyIcon";
import ShareIcon from "./components/svgs/ShareIcon";
import TrashIcon from "./components/svgs/TranshIcon";
import RenameIcon from "./components/svgs/RenameIcon";
import ListLoader from "./components/loaders/ListLoader";
import {ListCardsSkeleton} from "./components/loaders/PageSkeleton";
import List from "./components/parts/List";
import ChatWidget from "./components/ChatWidget";
import SiteCredit from "./components/SiteCredit";

const HomeClient = ({
    isRegistered,
    userName,
    lists,
    serverToken,
    userId,
    metadata,
}) => {
    const [shareDialogOpen, setShareDialogOpen] = useState(null);
    const shareDialogOpenRef = useRef(null);
    shareDialogOpenRef.current = shareDialogOpen;
    const [shareDialogView, setShareDialogView] = useState("share");
    const [sharedWithUsers, setSharedWithUsers] = useState(null);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const {loading} = useLoadingContext();
    const {userData, token, error, loading: userLoading} = useUserContext();
    const {
        userLists,
        getShoppingList,
        hydrateUserLists,
        setUserLists,
        deleteList,
        copyShoppingList,
        hasDeletedLists,
        handleRenameClick,
        listSettings,
        setListSettings,
        handleRenameList,
        setIsInnerList,
        shoppingList,
        lenis,
    } = useListContext();
    const {overlay, showVerbConfirmation} = useOverlayContext();
    const {showNotification} = useNotificationContext();
    const [listsMetadata, setListsMetadata] = useState({});
    const chatWidgetRef = useRef(null);

    useEffect(() => {
        setListsMetadata(metadata);
        setIsInnerList(false);
        let active = true;
        if (userData && userData.id && token) {
            if (String(userData.id) === String(userId) && Array.isArray(lists)) {
                hydrateUserLists(userData.id, lists);
                setInitialLoadComplete(true);
            } else {
                getShoppingList(userData.id, token).finally(() => {
                    if (active) setInitialLoadComplete(true);
                });
            }
        } else if (!userLoading && !token) {
            setInitialLoadComplete(true);
        }
        return () => { active = false; };
    }, [userData, token, userLoading]);

    useEffect(() => {
        const removeListData = sessionStorage.getItem("removeListData");
        if (removeListData) {
            try {
                const {listId, userId, token, selfInitiated} =
                    JSON.parse(removeListData);
                sessionStorage.removeItem("removeListData"); // Clear the data

                // Decide notification based on self-removal flag or suppress flag
                let suppress = false;
                try {
                    suppress =
                        sessionStorage.getItem("suppressSelfRemovalToast") ===
                        "1";
                } catch {}
                if (selfInitiated) {
                    if (!suppress) {
                        showNotification(
                            "List removed successfully",
                            "success"
                        );
                    }
                    try {
                        sessionStorage.removeItem("suppressSelfRemovalToast");
                    } catch {}
                } else {
                    showNotification(
                        "The list owner has removed you from this list",
                        "info"
                    );
                }

                // Small delay to ensure the page is fully loaded
                setTimeout(() => {
                    removeListRelationship(listId, userId, token, "inner");
                    gsap.fromTo(
                        `#list-${listId}`,
                        {
                            opacity: 1,
                            border: "1px solid #ff0000",
                            duration: 0.32,
                        },
                        {
                            opacity: 0,
                            y: 100,
                            ease: "power2.out",
                            duration: 0.8,
                            onComplete: () => {
                                setUserLists((prevLists) =>
                                    prevLists.filter(
                                        (list) => list.id !== listId
                                    )
                                );
                            },
                        }
                    );
                }, 100);
            } catch (error) {
                console.error("Error parsing removeListData:", error);
                sessionStorage.removeItem("removeListData");
            }
        }
    }, []);

    // Animate settings menu open when listSettings is set
    useEffect(() => {
        if (!listSettings) return;
        const sel = `#menu-${listSettings}`;
        const el =
            typeof document !== "undefined" && document.querySelector(sel);
        if (!el) return;
        gsap.killTweensOf(el);
        gsap.set(el, {opacity: 0, y: -8, scale: 0.96, transformOrigin: "top right", overflow: "visible"});
        gsap.to(el, {
            scale: 1,
            opacity: 1,
            y: 0,
            duration: 0.32,
            ease: "power2.out",
        });
    }, [listSettings]);

    const handleDragEnd = async (result) => {
        if (lenis.current) lenis.current.options.smoothWheel = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!result.destination || result.source.index === result.destination.index) return;
        invalidateCurrentLists();
        const items = Array.from(userLists);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        const orderedItems = items.map((item, index) => ({...item, menu_order: index + 1}));
        setUserLists(orderedItems);
        const updates = items.map((item, index) => ({
            id: item.id,
            menu_order: index + 1,
        }));

        try {
            const response = await fetch(`${WP_API_BASE}/wp/v2/shopping-list/order`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({orders: updates}),
            });
            if (!response.ok) throw new Error("Could not save list order");
            invalidateCurrentLists();
        } catch (error) {
            console.error("Reorder failed:", error);
            setUserLists(userLists);
        }
    };

    const handleDragStart = () => {
        setListSettings(false);
    };

    const handleListSettings = (id) => {
        if (listSettings === id) {
            // Animate close then unmount
            const sel = `#menu-${id}`;
            const el =
                typeof document !== "undefined" && document.querySelector(sel);
            if (el) {
                gsap.killTweensOf(el);
                gsap.to(el, {
                    scale: 0.96,
                    opacity: 0,
                    y: -6,
                    duration: 0.3,
                    ease: "power2.in",
                    onComplete: () => setListSettings(false),
                });
            } else {
                setListSettings(false);
            }
        } else {
            setListSettings(id);
        }
    };

    const openShareDialog = (list, view = "share") => {
        setListSettings(false);
        setSharedWithUsers(Array.isArray(list?.acf?.shared_with_users) ? list.acf.shared_with_users : []);
        setShareDialogView(view);
        setShareDialogOpen(list.id);
    };

    const handleDeleteList = async (id, token, state) => {
        deleteList(id, token, state);
    };

    // handle esc or click outside to close the settings (animate close)
    useEffect(() => {
        const handleClickOutside = (event) => {
            const target = event.target;
            const isSettingsIcon = target.closest(".list-card-action");
            const openMenuSel = listSettings ? `#menu-${listSettings}` : null;
            const isInsideMenu = openMenuSel
                ? target.closest(openMenuSel)
                : null;
            if (!isSettingsIcon && !isInsideMenu) {
                if (listSettings) {
                    handleListSettings(listSettings);
                }
            }
        };
        const handleEsc = (event) => {
            if (event.key === "Escape") {
                if (listSettings) {
                    handleListSettings(listSettings);
                }
            }
        };
        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleEsc);
        return () => {
            document.removeEventListener("click", handleClickOutside);
            document.removeEventListener("keydown", handleEsc);
        };
    }, [listSettings]);

    const handleCopyList = async (id) => {
        const copiedList = await copyShoppingList(id, token);
        if (!copiedList || !copiedList.success) {
            showNotification("Failed to copy list", "error");
            return;
        }

        // Get the fresh list data
        const newList = {
            ...copiedList.list,
            isNew: true,
        };

        // Find the index of the original list
        const originalIndex = userLists.findIndex((list) => list.id === id);

        // Force a refresh of the lists
        setUserLists((prev) => {
            const updatedLists = [...prev]; // Create new array
            // Insert the new list at the same position as the original
            updatedLists.splice(originalIndex + 1, 0, newList);
            return updatedLists;
        });

        showNotification("List Copied", "success", 1000);

        // Remove the "new" status after animation
        setTimeout(() => {
            setUserLists((prev) =>
                prev.map((list) => ({
                    ...list,
                    isNew: false,
                }))
            );
        }, 3000);

        setListSettings(false);

        // Fetch all lists again to ensure everything is in sync
        if (userData?.id) {
            setTimeout(() => {
                getShoppingList(userData.id, token, {force: true});
            }, 500);
        }
    };

    const showDeletionConfirmation = (listId, token) => {
        handleDeleteList(listId, token, "autoDelete");
    };

    // In homepage component
    useEffect(() => {
        const pendingDeletion = sessionStorage.getItem("pendingDeletion");
        if (pendingDeletion) {
            const {listId, token, expires} = JSON.parse(pendingDeletion);
            if (expires > Date.now() && token === serverToken) {
                showDeletionConfirmation(listId, token);
            }

            sessionStorage.removeItem("pendingDeletion");
        }
    }, []);

    useUserListsRealtime(userData?.id, setUserLists);
    useRealtimeAllListDelete(
        userLists,
        setUserLists,
        userData?.id,
        showNotification
    );
    useSharedListsRealtime(userData?.id, setUserLists, showNotification);

    useEffect(() => {
        if (!userData?.id) return;
        return subscribePusherEvent("user-lists-" + userData.id, "share-update", (data) => {
            invalidateCurrentLists();
            if (data.action === "add") {
                const newUser = {
                    ID: parseInt(data.userId),
                    display_name: data.userName,
                };

                let nextSharedUsers = null;
                setUserLists((prevLists) =>
                    prevLists.map((list) => {
                        if (parseInt(list.id) === parseInt(data.listId)) {
                            const updatedUsers = [
                                ...(list.acf.shared_with_users || []),
                                newUser,
                            ];
                            if (shareDialogOpenRef.current === parseInt(data.listId)) {
                                nextSharedUsers = updatedUsers;
                            }
                            return {
                                ...list,
                                acf: {
                                    ...list.acf,
                                    shared_with_users: updatedUsers,
                                },
                            };
                        }
                        return list;
                    })
                );

                if (nextSharedUsers) setSharedWithUsers(nextSharedUsers);

                showNotification(
                    `${data.userName} was added to the list`,
                    "success"
                );
            }
        });
    }, [userData?.id, setUserLists, showNotification]);

    // Prefer client context for header auth state to avoid SSR/CSR mismatch flicker
    const headerRegistered =
        userData?.registered === "yes" ? true : isRegistered;
    const headerUserName = userData?.name || userName;

    if (error) return <div>Error: {error}</div>;
    return (
        <main className="home-page transition-all duration-300">
            <Header isRegistered={headerRegistered} userName={headerUserName} />

            <div className="home-content">
                <div className="home-lists">
                    <div className="home-lists-heading">
                        <div>
                            <p className="home-eyebrow">YOUR SPACE</p>
                            <h1>Shopping lists</h1>
                            <p>Keep every shop organised in one place.</p>
                        </div>
                    <Button
                        cta={"Create list"}
                        content={"single-input"}
                        action={"create-list"}
                        cancelAction={"true"}
                        textColorOverride={"text-white"}
                        overrideDefaultClasses="app-primary-action"
                    />
                    </div>

                    {/* Actual List */}
                    {userLists && userLists.length > 0 ? (
                        <DragDropContext
                            onBeforeCapture={() => {
                                if (!lenis.current) return;
                                lenis.current.scrollTo(lenis.current.actualScroll, {immediate: true});
                                lenis.current.options.smoothWheel = false;
                            }}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <Droppable droppableId="lists">
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="home-list-stack home-list-draggable-stack group"
                                    >
                                        {userLists.map((list, index) => (
                                            <Draggable
                                                key={list.id}
                                                draggableId={String(list.id)}
                                                index={index}
                                            >
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className="relative home-list-slot"
                                                        style={provided.draggableProps.style}
                                                    >
                                                        <List
                                                            listSettings={
                                                                listSettings
                                                            }
                                                            token={serverToken}
                                                            list={list}
                                                            provided={{dragHandleProps: provided.dragHandleProps}}
                                                            snapshot={snapshot}
                                                            handleListSettings={
                                                                handleListSettings
                                                            }
                                                            onManageAccess={(selectedList) => openShareDialog(selectedList, "members")}
                                                            handleRenameList={
                                                                handleRenameList
                                                            }
                                                            listsMetadata={
                                                                listsMetadata
                                                            }
                                                            userId={userId}
                                                            ownerMetadata={
                                                                listsMetadata[
                                                                    list.id
                                                                ]
                                                            }
                                                        />

                                                {/*  List Actions (out for z-index over other lists. closes on drag) */}
                                                {listSettings === list.id && (
                                                    <div
                                                        id={`menu-${list.id}`}
                                                        className="home-list-menu tools"
                                                    >
                                                        <div className="flex font-quicksand font-[500] flex-col gap-0.5">
                                                            <button
                                                                onClick={() =>
                                                                    handleRenameClick(
                                                                        list.id
                                                                    )
                                                                }
                                                                className=" cursor-pointer px-3 py-1 flex items-center tool text-left duration-200 transition-colors dark:text-white rounded-sm"
                                                            >
                                                                <RenameIcon className="w-4 h-4 inline-block mr-1" />
                                                                Rename
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    handleCopyList(
                                                                        list.id
                                                                    )
                                                                }
                                                                className="px-3 py-1 tool cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm"
                                                            >
                                                                <CopyIcon className="w-4 h-4 inline-block mr-1" />
                                                                Copy
                                                            </button>
                                                            <button
                                                                onClick={() => openShareDialog(list)}
                                                                className="px-3 py-1 tool cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm"
                                                            >
                                                                <ShareIcon className="w-4 h-4 inline-block mr-1" />
                                                                Share
                                                            </button>
                                                            {isListOwner(
                                                                list,
                                                                userData?.id
                                                            ) && (
                                                                <button
                                                                    onClick={() => {
                                                                        showVerbConfirmation(
                                                                            list,
                                                                            token,
                                                                            "delete",
                                                                            userData?.id
                                                                        );
                                                                    }}
                                                                    className="px-3 py-1 cursor-pointer tool-danger  text-left duration-200 transition-colors text-red-500 rounded-sm"
                                                                >
                                                                    <TrashIcon className="w-4 h-4 inline-block mr-1" />
                                                                    Delete
                                                                </button>
                                                            )}

                                                            {!isListOwner(
                                                                list,
                                                                userData?.id
                                                            ) && (
                                                                <button
                                                                    onClick={() => {
                                                                        showVerbConfirmation(
                                                                            list,
                                                                            token,
                                                                            "remove",
                                                                            userData?.id
                                                                        );
                                                                    }}
                                                                    className="px-3 py-1 cursor-pointer tool-danger text-red-500 text-left duration-200 transition-colors text-red-500 rounded-sm"
                                                                >
                                                                    <TrashIcon className="w-4 h-4 inline-block mr-1" />
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}

                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    ) : !initialLoadComplete &&
                      !hasDeletedLists &&
                      lists &&
                      lists.length > 0 ? (
                        <div className="home-list-stack">
                            {lists.map((list) => (
                                <List
                                    token={token}
                                    decoy={true}
                                    key={list.id}
                                    list={list}
                                    handleListSettings={handleListSettings}
                                    handleRenameList={handleRenameList}
                                    userId={userId}
                                    listsMetadata={listsMetadata}
                                />
                            ))}
                        </div>
                    ) : !initialLoadComplete ? (
                        <ListCardsSkeleton count={userLists?.length || lists?.length || 0} />
                    ) : (
                        // No lists found
                        <div className="home-empty-state">
                            <h2>No shopping lists yet</h2>
                            <p>Create a list to get started.</p>
                        </div>
                    )}
                </div>

                <div className="home-prompt-card">
                    <p>Need a hand planning?</p>
                    <span>
                        <span
                            onClick={() =>
                                chatWidgetRef.current?.openWidget?.()
                            }
                            className="font-quicksand font-black brand-color hover:text-primary duration-200 transition-colors cursor-pointer"
                        >
                            Ask Lista{" "}
                        </span>
                        to create lists and add ingredients.
                    </span>
                </div>
            </div>

            <footer className="site-footer"><SiteCredit /></footer>

            {overlay && <Overlay handleDeleteList={handleDeleteList} />}

            {loading && (
                <div className="fixed z-[9999] inset-0 w-full min-h-dvh bg-[#07101fd9] backdrop-blur-sm flex items-center justify-center">
                    <ListLoader name={shoppingList?.name} />
                </div>
            )}

            <Notification />

            <ChatWidget ref={chatWidgetRef} context="home" token={token} />

            {shareDialogOpen && (
                <ShareListDialog
                    token={token}
                    userId={userData?.id}
                    list={userLists.find((list) => list.id === shareDialogOpen)}
                    listId={shareDialogOpen}
                    sharedWithUsers={sharedWithUsers}
                    initialView={shareDialogView}
                    onClose={() => {
                        setShareDialogOpen(null);
                        setShareDialogView("share");
                    }}
                    setSharedWithUsers={setSharedWithUsers}
                />
            )}
        </main>
    );
};

export default HomeClient;
