'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// Contexts
import { useUserContext } from "./contexts/UserContext";
import { useOverlayContext } from "./contexts/OverlayContext";
import { useListContext } from "./contexts/ListContext";
import { useLoadingContext } from "./contexts/LoadingContext";

// Components
import Navigation from "./components/Navigation";
import Button from "./components/Button";
import Overlay from "./components/modals/Overlay";
import Notification from "./components/Notification";

// Icons
import SettingsIcon from "./components/svgs/SettingsIcon";
import RenameIcon from "./components/svgs/RenameIcon";
import ShareIcon from "./components/svgs/ShareIcon";
import CopyIcon from "./components/svgs/CopyIcon";
import TrashIcon from "./components/svgs/TranshIcon";
import ListLoader from "./components/loaders/ListLoader";


const HomeClient = ({ isRegistered, userName }) => {
    const [listSettings, setListSettings] = useState(false);
    const { loading } = useLoadingContext();
    const { userData, token, error } = useUserContext();
    const { userLists, getShoppingList, setUserLists, deleteList } = useListContext();
    const { overlay } = useOverlayContext();


    function extractUserName(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return data.userName || null;
        } catch (error) {
            console.error("Invalid JSON:", error);
            return null;
        }
    }

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



    // if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    return (
        <main>
            {!isRegistered && <Navigation route={"/login"} link={"Login"} />}
            {isRegistered && <div className={" py-4 md:py-6 px-4 md:px-8 xl:px-16 flex justify-between items-center gap-12"}>
                <div className={"font-bold text-3xl"}>Lista</div>
                <div className="flex gap-y-2 gap-x-2 md:gap-4 items-center flex-wrap justify-end">

                    {(isRegistered) &&
                        <div className={" flex gap-2 items-center"}>
                            <span className="inline-block wave-emoji">👋</span>
                            <span className="text-xs md:text-sm lg:text-base"> {extractUserName(userName)}</span>
                        </div>
                    }
                    <Link className="text-white  py-3 px-6 xl:px-10 text-xs md:text-base font-bold rounded-full bg-blue-800" href={"/logout"} >
                        Logout
                    </Link>
                </div>
            </div>

            }

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
                    {userLists && userLists.length > 0 ? (
                        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                            <Droppable droppableId="lists">
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="mt-8 flex flex-col gap-4 w-full  "
                                    >
                                        {userLists.map((list, index) => (
                                            <div key={list.id} className="relative" >
                                                <Draggable draggableId={String(list.id)} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div id={`list-${list.id}`}
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`flex justify-between border items-center px-6 py-3 rounded-lg shadow-xl shadow-[#00000022] dark:bg-black bg-white min-w-full w-full md:min-w-[550px] transition-colors duration-200 hover:dark:bg-gray-900 hover:bg-gray-100 mx-auto relative ${snapshot.isDragging ? '!scale-90 dark:!bg-gray-900 !bg-gray-100 md:scale-110 !left-0 md:!left-[50%] md:!-translate-x-[50%]' : 'scale-100'}`}
                                                            style={{
                                                                touchAction: 'none',
                                                                ...provided.draggableProps.style
                                                            }}
                                                        >
                                                            <p className="font-bold text-lg">{list.title.rendered}</p>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // Prevent drag when clicking settings
                                                                    handleListSettings(list.id);
                                                                }}
                                                                className="relative !z-[9999]"
                                                            >
                                                                <SettingsIcon className="w-6 h-6 settings-icon dark:text-gray-600 text-gray-800 cursor-pointer" />

                                                            </button>
                                                        </div>
                                                    )}
                                                </Draggable>
                                                {listSettings === list.id && (
                                                    <div className="absolute right-12 top-2 mt-1  text-xs whitespace-nowrap py-1.5 px-1 shadow-[#00000055] rounded-sm bg-gray-200 dark:bg-gray-700 shadow-md z-30">
                                                        <div className="flex flex-col gap-0.5">
                                                            <button className="px-3 py-1 flex items-center hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors dark:text-white rounded-sm">
                                                                <RenameIcon className="w-4 h-4 inline-block mr-1" />
                                                                Rename
                                                            </button>
                                                            <button className="px-3 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors dark:text-white rounded-sm">
                                                                <CopyIcon className="w-4 h-4 inline-block mr-1" />
                                                                Copy
                                                            </button>
                                                            <button className="px-3 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors dark:text-white rounded-sm">
                                                                <ShareIcon className="w-4 h-4 inline-block mr-1" />
                                                                Share
                                                            </button>
                                                            <button onClick={() => { handleDeleteList(list.id, token) }} className="px-3 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 text-left duration-200 transition-colors text-red-500 rounded-sm">
                                                                <TrashIcon className="w-4 h-4 inline-block mr-1" />
                                                                Delete
                                                            </button>
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
                    ) : (
                        <p className="mt-12 text-xl font-black text-center">No shopping lists found.</p>
                    )}
                </div>

                <div className={"text-center "}>
                    <p className={"text-xl md:text-2xl"}>
                        <strong> Let&#39;s plan your shopping list!</strong>
                    </p>
                    <p className={"mt-2 md:text-lg text-gray-400"}>Use the button to start a new list </p>
                </div>
            </div>
            {overlay && <Overlay />}

            {loading &&
                <div className="fixed z-[9999] top-0 left-0 w-full h-full bg-[#00000055] flex items-center justify-center text-xl text-white">
                    <ListLoader />
                </div>
            }

            <Notification />
        </main >
    );
};

export default HomeClient;
