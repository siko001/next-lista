'use client';
import { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { WP_API_BASE } from "./lib/helpers";
import useUserListsRealtime from "./lib/UserListsRealTime"


// Contexts
import { useUserContext } from "./contexts/UserContext";
import { useListContext } from "./contexts/ListContext";
import { useOverlayContext } from "./contexts/OverlayContext";
import { useLoadingContext } from "./contexts/LoadingContext";
import { useNotificationContext } from "./contexts/NotificationContext";

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



const HomeClient = ({ isRegistered, userName, lists, serverToken }) => {

    const [shareDialogOpen, setShareDialogOpen] = useState(null);
    const { loading } = useLoadingContext();
    const { userData, token, error } = useUserContext();
    const { userLists, getShoppingList, setUserLists, deleteList, copyShoppingList, hasDeletedLists, handleRenameClick, listSettings, setListSettings, handleRenameList, setIsInnerList } = useListContext();
    const { overlay, showVerbConfirmation } = useOverlayContext();
    const { showNotification } = useNotificationContext();

    useEffect(() => {
        setIsInnerList(false);
        if (userData && userData.id && token) {
            getShoppingList(userData.id, token)
        }
    }, [userData, token]);


    const handleDragEnd = async (result) => {
        if (!result.destination) return;
        const items = Array.from(userLists);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setUserLists(items);
        const updates = items.map((item, index) => ({
            id: item.id,
            menu_order: index + 1
        }));

        try {
            await fetch(`${WP_API_BASE}/wp/v2/shopping-list/order`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ orders: updates })
            });
        } catch (error) {
            console.error("Reorder failed:", error);
            setUserLists(userLists);
        }
    };

    const handleDragStart = () => {
        setListSettings(false);
    }


    const handleListSettings = (id) => {
        if (listSettings === id) {
            setListSettings(false);
        } else {
            setListSettings(id);
        }
    }


    const handleDeleteList = async (id, token, state) => {
        deleteList(id, token, state);
    }


    // handle esc or click outside to close the settings
    useEffect(() => {
        const handleClickOutside = (event) => {
            const target = event.target;
            const isSettingsIcon = target.closest('.settings-icon');
            if (!isSettingsIcon) {
                setListSettings(false);
            }
        };
        const handleEsc = (event) => {
            if (event.key === 'Escape') {
                setListSettings(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, []);





    const handleCopyList = async (id) => {
        const copiedList = await copyShoppingList(id, token)
        if (!copiedList) {
            showNotification("Failed to copy list", "error");
            return;
        }
        showNotification("List Copied", "success", 1000);
        setUserLists((prev) => [
            {
                ...copiedList,
                id: copiedList.new_list_id,
                key: `list-${copiedList.new_list_id}`,
                title: copiedList.new_list_title,
                acf: {
                    product_count: copiedList.product_count,
                    products: []
                },
                isNew: true
            },
            ...prev
        ]);


        setTimeout(() => {
            setUserLists(prev => prev.map(list => ({
                ...list,
                isNew: false
            })));
        }, 3000);

        setListSettings(false);
    }

    const showDeletionConfirmation = (listId, token) => {
        handleDeleteList(listId, token, 'autoDelete');
    }

    // In homepage component
    useEffect(() => {
        const pendingDeletion = sessionStorage.getItem('pendingDeletion');
        if (pendingDeletion) {
            const { listId, token, expires } = JSON.parse(pendingDeletion);
            if (expires > Date.now() && token === serverToken) {
                showDeletionConfirmation(listId, token);
            }

            sessionStorage.removeItem('pendingDeletion');
        }
    }, []);

    useUserListsRealtime(userData?.id, setUserLists);

    if (error) return <div>Error: {error}</div>;
    return (
        <main className=" transition-all duration-300">

            <Header isRegistered={isRegistered} userName={userName} />

            <div className={" flex flex-col gap-16 md:gap-36 py-12 md:py-24 px-8 "}>
                <div className={"mx-auto flex flex-col items-center  w-full  md:w-fit  "}>
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
                        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                            <Droppable droppableId="lists">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="mt-8 flex flex-col gap-6 w-full group  ">
                                        {userLists.map((list, index) => (
                                            // List Wrapper
                                            <div key={list.id} className="relative" >

                                                {/* Draggable Item */}
                                                <Draggable key={list.id} draggableId={String(list.id)} index={index}>
                                                    {(provided, snapshot) => (
                                                        <List listSettings={listSettings} token={serverToken} list={list} provided={provided} snapshot={snapshot} handleListSettings={handleListSettings} handleRenameList={handleRenameList} />
                                                    )}
                                                </Draggable>

                                                {/*  List Actions (out for z-index over other lists. closes on drag) */}
                                                {
                                                    listSettings === list.id && (
                                                        <div className="absolute right-12 top-2 mt-1  text-xs whitespace-nowrap py-1.5 px-1 shadow-[#00000055] rounded-sm bg-gray-200 dark:bg-gray-700 shadow-md z-30">
                                                            <div className="flex font-quicksand font-[500] flex-col gap-0.5">
                                                                <button onClick={() => handleRenameClick(list.id)} className=" cursor-pointer px-3 py-1 flex items-center hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors dark:text-white rounded-sm">
                                                                    <RenameIcon className="w-4 h-4 inline-block mr-1" />
                                                                    Rename
                                                                </button>
                                                                <button onClick={() => handleCopyList(list.id)} className="px-3 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm">
                                                                    <CopyIcon className="w-4 h-4 inline-block mr-1" />
                                                                    Copy
                                                                </button>
                                                                <button onClick={() => setShareDialogOpen(list.id)} className="px-3 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm">
                                                                    <ShareIcon className="w-4 h-4 inline-block mr-1" />
                                                                    Share
                                                                </button>
                                                                <button onClick={() => {
                                                                    showVerbConfirmation(list, token, "delete");
                                                                }}
                                                                    className="px-3 py-1 cursor-pointer  hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors text-red-500 rounded-sm">
                                                                    <TrashIcon className="w-4 h-4 inline-block mr-1" />
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                }

                                            </div>
                                        ))}

                                        {provided.placeholder}
                                    </div>
                                )}

                            </Droppable>
                        </DragDropContext>

                    ) : (
                        // Lists Loaded from the server (if any pre-rendered)
                        !hasDeletedLists && lists && lists.length > 0 ? (
                            <div className="mt-8 flex flex-col gap-6 w-full  ">
                                {lists.map((list) => (
                                    <List token={token} decoy={true} key={list.id} list={list} handleListSettings={handleListSettings} handleRenameList={handleRenameList} />
                                ))}
                            </div>
                        ) : (

                            // No lists found
                            <p className="mt-12 text-xl font-black text-center">No shopping lists found.</p>
                        )
                    )}
                </div>


                <div className={"text-center "}>
                    <p className={"text-xl md:text-2xl"}>
                        <strong>
                            Let&#39;s plan your shopping list!
                        </strong>
                    </p>
                    <p className={"mt-2 md:text-lg text-gray-400"}>Use the button to start a new list </p>
                </div>

            </div>


            {overlay && <Overlay handleDeleteList={handleDeleteList} />}

            {loading && <div className="fixed z-[9999] top-0 left-0 w-full h-full bg-[#00000055] flex items-center justify-center text-xl text-white">  <ListLoader />  </div>}

            <Notification />

            {shareDialogOpen && (
                <ShareListDialog
                    listId={shareDialogOpen}
                    onClose={() => setShareDialogOpen(null)}
                />
            )}

        </main >
    );
};

export default HomeClient;
