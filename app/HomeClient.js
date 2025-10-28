"use client";
import {useEffect, useState} from "react";
import {DragDropContext, Droppable, Draggable} from "@hello-pangea/dnd";
import {WP_API_BASE, isListOwner, removeListRelationship} from "./lib/helpers";
import gsap from "gsap";
import Pusher from "pusher-js";

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
import List from "./components/parts/List";
import ChatWidget from "./components/ChatWidget";

const HomeClient = ({
    isRegistered,
    userName,
    lists,
    serverToken,
    userId,
    metadata,
}) => {
    const [shareDialogOpen, setShareDialogOpen] = useState(null);
    const [sharedWithUsers, setSharedWithUsers] = useState(null);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const {loading} = useLoadingContext();
    const {userData, token, error} = useUserContext();
    const {
        userLists,
        getShoppingList,
        setUserLists,
        deleteList,
        copyShoppingList,
        hasDeletedLists,
        handleRenameClick,
        listSettings,
        setListSettings,
        handleRenameList,
        setIsInnerList,
    } = useListContext();
    const {overlay, showVerbConfirmation} = useOverlayContext();
    const {showNotification} = useNotificationContext();
    const [listsMetadata, setListsMetadata] = useState({});

    useEffect(() => {
        setListsMetadata(metadata);
        setIsInnerList(false);
        if (userData && userData.id && token) {
            getShoppingList(userData.id, token).then(() => {
                setInitialLoadComplete(true);
            });
        }
    }, [userData, token]);

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
                            duration: 0.5,
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
        gsap.set(el, {height: 0, opacity: 0, y: -6, overflow: "hidden"});
        gsap.to(el, {
            height: "auto",
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: "power2.out",
            onComplete: () => gsap.set(el, {clearProps: "height"}),
        });
    }, [listSettings]);

    const handleDragEnd = async (result) => {
        if (!result.destination) return;
        const items = Array.from(userLists);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setUserLists(items);
        const updates = items.map((item, index) => ({
            id: item.id,
            menu_order: index + 1,
        }));

        try {
            await fetch(`${WP_API_BASE}/wp/v2/shopping-list/order`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({orders: updates}),
            });
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
                const currentH = el.scrollHeight;
                gsap.set(el, {height: currentH, overflow: "hidden"});
                gsap.to(el, {
                    height: 0,
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

    const handleDeleteList = async (id, token, state) => {
        deleteList(id, token, state);
    };

    // handle esc or click outside to close the settings (animate close)
    useEffect(() => {
        const handleClickOutside = (event) => {
            const target = event.target;
            const isSettingsIcon = target.closest(".settings-icon");
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
                getShoppingList(userData.id, token);
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
        const pusher = new Pusher("a9f747a06cd5ec1d8c62", {
            cluster: "eu",
        });

        const channel = pusher.subscribe("user-lists-" + userData.id);

        channel.bind("share-update", (data) => {
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
                            if (shareDialogOpen === parseInt(data.listId)) {
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

        return () => {
            channel.unbind_all();
            pusher.unsubscribe("user-lists-" + userData.id);
        };
    }, [userData?.id, shareDialogOpen, userLists]);

    // Prefer client context for header auth state to avoid SSR/CSR mismatch flicker
    const headerRegistered =
        userData?.registered === "yes" ? true : isRegistered;
    const headerUserName = userData?.name || userName;

    if (error) return <div>Error: {error}</div>;
    return (
        <main className=" transition-all duration-300">
            <Header isRegistered={headerRegistered} userName={headerUserName} />

            <div
                className={
                    " flex flex-col gap-16 md:gap-36 py-12 md:py-24 px-8 "
                }
            >
                <div
                    className={
                        "mx-auto flex flex-col items-center  w-full  md:w-fit  "
                    }
                >
                    <Button
                        cta={"Create a new list"}
                        content={"single-input"}
                        action={"create-list"}
                        cancelAction={"true"}
                        color={"#21ba9c"}
                        hover={"inwards"}
                        textColorOverride={"text-white"}
                    />

                    {/* Actual List */}
                    {userLists && userLists.length > 0 ? (
                        <DragDropContext
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <Droppable droppableId="lists">
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="mt-8 flex flex-col gap-6 w-full group  "
                                    >
                                        {userLists.map((list, index) => (
                                            // List Wrapper
                                            <div
                                                key={list.id}
                                                className="relative"
                                            >
                                                {/* Draggable Item */}
                                                <Draggable
                                                    key={list.id}
                                                    draggableId={String(
                                                        list.id
                                                    )}
                                                    index={index}
                                                >
                                                    {(provided, snapshot) => (
                                                        <List
                                                            listSettings={
                                                                listSettings
                                                            }
                                                            token={serverToken}
                                                            list={list}
                                                            provided={provided}
                                                            snapshot={snapshot}
                                                            handleListSettings={
                                                                handleListSettings
                                                            }
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
                                                    )}
                                                </Draggable>

                                                {/*  List Actions (out for z-index over other lists. closes on drag) */}
                                                {listSettings === list.id && (
                                                    <div
                                                        id={`menu-${list.id}`}
                                                        className="absolute right-12 top-2 mt-1  text-xs whitespace-nowrap py-1.5 px-1 shadow-[#00000055] rounded-sm tools shadow-md z-30 overflow-hidden"
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
                                                                onClick={() => {
                                                                    setShareDialogOpen(
                                                                        list.id
                                                                    );
                                                                    setSharedWithUsers(
                                                                        list.acf
                                                                            .shared_with_users
                                                                    );
                                                                }}
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
                                                                    className="px-3 py-1 cursor-pointer   text-left duration-200 transition-colors text-red-500 rounded-sm"
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
                                                                    className="px-3 py-1 cursor-pointer text-red-500 text-left duration-200 transition-colors text-red-500 rounded-sm"
                                                                >
                                                                    <TrashIcon className="w-4 h-4 inline-block mr-1" />
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
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
                        <div className="mt-8 flex flex-col gap-6 w-full">
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
                    ) : (
                        // No lists found
                        <p className="mt-12 text-xl font-black text-center">
                            No shopping lists found.
                        </p>
                    )}
                </div>

                <div className={"text-center "}>
                    <p className={"text-xl md:text-2xl"}>
                        <strong>Let&#39;s plan your shopping list!</strong>
                    </p>
                    <p className={"mt-2 md:text-md text-gray-200"}>
                        Prompt to create lists & add ingredents
                    </p>
                    <p className={"mt-2 md:text-md text-gray-400"}>
                        Use the button to start a new list
                    </p>
                </div>
            </div>

            {overlay && <Overlay handleDeleteList={handleDeleteList} />}

            {loading && (
                <div className="fixed z-[9999] top-0 left-0 w-full h-full bg-[#00000055] flex items-center justify-center text-xl text-white">
                    <ListLoader />
                </div>
            )}

            <Notification />

            <ChatWidget context="home" token={token} />

            {shareDialogOpen && (
                <ShareListDialog
                    token={token}
                    userId={userData?.id}
                    list={userLists.find((list) => list.id === shareDialogOpen)}
                    listId={shareDialogOpen}
                    sharedWithUsers={sharedWithUsers}
                    onClose={() => setShareDialogOpen(null)}
                    setSharedWithUsers={setSharedWithUsers}
                />
            )}
        </main>
    );
};

export default HomeClient;
