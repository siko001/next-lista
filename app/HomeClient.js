'use client';
import { useEffect, useState, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

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

// Icons
import CopyIcon from "./components/svgs/CopyIcon";
import ShareIcon from "./components/svgs/ShareIcon";
import TrashIcon from "./components/svgs/TranshIcon";
import RenameIcon from "./components/svgs/RenameIcon";
import ListLoader from "./components/loaders/ListLoader";
import List from "./components/parts/List";



const HomeClient = ({ isRegistered, userName, lists }) => {
    const [listSettings, setListSettings] = useState(false);

    const [listRename, setListRename] = useState(false);
    const [startingValue, setStartingValue] = useState(null);
    const listRenameRef = useRef(null);

    const { loading } = useLoadingContext();
    const { userData, token, error } = useUserContext();
    const { userLists, getShoppingList, setUserLists, deleteList } = useListContext();
    const { overlay } = useOverlayContext();
    const { showNotification } = useNotificationContext();


    useEffect(() => {
        if (userData && userData.id && token) {
            getShoppingList(userData.id, token)
        }
    }, [userData, token]);


    const handleDragEnd = async (result) => {
        if (!result.destination) return;
        const WP_API_BASE = " https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json"
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


    const handleDeleteList = async (id, token) => {
        deleteList(id, token);
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


    const handleRenameList = async (value) => {
        if (!value) return;
        const listId = listRename;
        const list = userLists.find((list) => list.id === listId);
        if (!list) return;

        // Prepare the update payload
        const updateData = {
            title: value,
        };

        // Optimistic UI update
        const updatedLists = userLists.map((list) =>
            list.id === listId
                ? {
                    ...list,
                    title: {
                        rendered: value,
                        raw: value
                    }
                }
                : list
        );
        setUserLists(updatedLists);

        // Reset UI states
        setListRename(false);
        setStartingValue(null);

        // Send to server
        const WP_API_BASE = "https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json";
        try {
            const response = await fetch(`${WP_API_BASE}/wp/v2/shopping-list/${listId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) throw new Error('Failed to update');

            const data = await response.json();
            if (!data) {
                showNotification("Failed to update list", "error");
                setUserLists(userLists);
                return;
            }

            showNotification("List Renamed", "success", 1000);

        } catch (error) {
            console.error("Error updating list:", error);
            showNotification("Failed to update list", "error");
            // Revert optimistic update if failed
            setUserLists(userLists);
        }
    }

    const handleRenameInput = (e) => {
        let input = e.target.value
        if (input.length > 32) {
            input = input.slice(0, 32);
        }
        listRenameRef.current.value = input;
        setStartingValue(input.length);
    };

    const handleRenameClick = (id) => {
        if (listRename === id) {
            setListRename(false);
        } else {
            setListRename(id);
            setTimeout(() => {
                listRenameRef.current.focus();
                // starting number
                setStartingValue(listRenameRef.current.value.length);
            }, 0);
        }
        setListSettings(false);
    }



    // if (loading) return <div>Loading...</div>;
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
                                                <Draggable draggableId={String(list.id)} index={index}>
                                                    {(provided, snapshot) => (
                                                        <List setStartingValue={setStartingValue} startingValue={startingValue} list={list} provided={provided} snapshot={snapshot} handleListSettings={handleListSettings} handleRenameList={handleRenameList} listRename={listRename} setListRename={setListRename} listRenameRef={listRenameRef} handleRenameInput={handleRenameInput} />
                                                    )}
                                                </Draggable>

                                                {/*  List Actions (out for z-index over other lists. closes on drag) */}
                                                {
                                                    listSettings === list.id && (
                                                        <div className="absolute right-12 top-2 mt-1  text-xs whitespace-nowrap py-1.5 px-1 shadow-[#00000055] rounded-sm bg-gray-200 dark:bg-gray-700 shadow-md z-30">
                                                            <div className="flex flex-col gap-0.5">
                                                                <button onClick={() => handleRenameClick(list.id)} className=" cursor-pointer px-3 py-1 flex items-center hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors dark:text-white rounded-sm">
                                                                    <RenameIcon className="w-4 h-4 inline-block mr-1" />
                                                                    Rename
                                                                </button>
                                                                <button className="px-3 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm">
                                                                    <CopyIcon className="w-4 h-4 inline-block mr-1" />
                                                                    Copy
                                                                </button>
                                                                <button className="px-3 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer  text-left duration-200 transition-colors dark:text-white rounded-sm">
                                                                    <ShareIcon className="w-4 h-4 inline-block mr-1" />
                                                                    Share
                                                                </button>
                                                                <button onClick={() => { handleDeleteList(list.id, token) }} className="px-3 py-1 cursor-pointer  hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors text-red-500 rounded-sm">
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
                        lists && lists.length > 0 ? (
                            <div className="mt-8 flex flex-col gap-6 w-full  ">
                                {lists.map((list) => (
                                    <List decoy={true} key={list.id} startingValue={startingValue} list={list} handleListSettings={handleListSettings} handleRenameList={handleRenameList} listRename={listRename} setListRename={setListRename} listRenameRef={listRenameRef} handleRenameInput={handleRenameInput} />
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


            {overlay && <Overlay />}

            {loading && <div className="fixed z-[9999] top-0 left-0 w-full h-full bg-[#00000055] flex items-center justify-center text-xl text-white">  <ListLoader />  </div>}

            <Notification />

        </main >
    );
};

export default HomeClient;
