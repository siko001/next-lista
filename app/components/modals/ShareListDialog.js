"use client";
import {useState, useEffect} from "react";
import WhatsAppIcon from "../svgs/WhatsappIcon";
import MessengerIcon from "../svgs/MessengerIcon";
import LinkIcon from "../svgs/LinkIcon";
import {useNotificationContext} from "../../contexts/NotificationContext";
import {useUserContext} from "../../contexts/UserContext";
import {useListContext} from "../../contexts/ListContext";
import BinocularIcon from "../svgs/BinocularIcon";
import CloseIcon from "../svgs/CloseIcon";
import MinusIcon from "../svgs/MinusIcon";
import {removeListRelationship, WP_API_BASE} from "../../lib/helpers";

const ShareListDialog = ({
    listId,
    onClose,
    sharedWithUsers,
    token,
    setSharedWithUsers,
}) => {
    const {showNotification} = useNotificationContext();
    const {userLists, setUserLists} = useListContext();
    const {token: userToken} = useUserContext();
    const listUrl = `${window.location.origin}/shared-list/${listId}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
        `Sharing this list with you: ${listUrl}`
    )}`;

    console.log(sharedWithUsers);

    // const messengerUrl = `fb-messenger://share?link=${encodeURIComponent(listUrl)}`;
    function shareOnMessenger(listUrl) {
        const encodedUrl = encodeURIComponent(listUrl);

        if (
            /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            )
        ) {
            window.location.href = `fb-messenger://share?link=${encodedUrl}`;
            setTimeout(() => {
                window.location.href = `https://m.me/share?u=${encodedUrl}`;
            }, 500);
        } else {
            window.open(
                `https://www.facebook.com/dialog/send?link=${encodedUrl}&redirect_uri=${encodeURIComponent(
                    window.location.href
                )}`,
                "_blank"
            );
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(listUrl);
        showNotification("Link copied to clipboard!", "success", 3000);
        onClose();
    };

    useEffect(() => {
        // close if clicked outside the modal
        const handleClickOutside = (event) => {
            if (event.target.classList.contains("fixed")) {
                onClose();
            }
        };
        // close on escape key press
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        // add event listener to close modal if clicked outside
        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        // cleanup function to remove event listener
        return () => {
            document.removeEventListener("click", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    });

    const [usersSharedWithOverlay, setUsersSharedWithOverlay] = useState(false);
    const handleSeeUsersSharedWith = () => {
        setUsersSharedWithOverlay(true);
    };

    const handleRevokeShare = async (listId, userId, token) => {
        try {
            const res = await fetch(
                `${WP_API_BASE}/custom/v1/remove-user-from-shared`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({listId, userId}),
                }
            );

            const data = await res.json();
            if (data.message === "User removed from shared list") {
                // Update local shared users state
                setSharedWithUsers((prev) =>
                    prev.filter((user) => user.ID !== userId)
                );

                // Update the userLists state to reflect the change in shared_with_users
                setUserLists((prevLists) =>
                    prevLists.map((list) => {
                        if (list.id === listId) {
                            return {
                                ...list,
                                acf: {
                                    ...list.acf,
                                    shared_with_users:
                                        list.acf.shared_with_users.filter(
                                            (user) => user.ID !== userId
                                        ),
                                },
                            };
                        }
                        return list;
                    })
                );

                showNotification("User removed from shared list", "success");
                if (sharedWithUsers.length === 1) {
                    setUsersSharedWithOverlay(false);
                }
            }
        } catch (error) {
            console.error("Error removing user:", error);
            showNotification("Failed to remove user", "error");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            {!usersSharedWithOverlay && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg  w-full max-w-[90%] sm:max-w-sm">
                    <h3 className="text-lg font-bold mb-4 dark:text-white">
                        Share List
                    </h3>

                    <div className="space-y-3">
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex cursor-pointer items-center px-4 py-2 bg-green-700 text-white rounded hover:bg-green-600"
                        >
                            <WhatsAppIcon className={"w-7 h-7 mr-2"} />
                            Share via WhatsApp
                        </a>

                        <a
                            onClick={shareOnMessenger}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex cursor-pointer items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            <MessengerIcon className={"w-8 h-8 mr-2"} />
                            Share via Messenger
                        </a>

                        <button
                            onClick={copyToClipboard}
                            className="flex cursor-pointer items-center px-4 py-2 bg-gray-200 dark:bg-gray-400 rounded hover:bg-gray-300 dark:hover:bg-gray-600 w-full"
                        >
                            <LinkIcon className="w-7 h-7 mr-3" />
                            Copy Link
                        </button>
                        {sharedWithUsers?.length > 0 && (
                            <button
                                onClick={handleSeeUsersSharedWith}
                                className="flex cursor-pointer items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 w-full"
                            >
                                <BinocularIcon className="w-7 h-7 mr-3" />
                                See Users Shared With
                            </button>
                        )}
                    </div>

                    <div>
                        <button
                            onClick={onClose}
                            className="mt-4 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-sm cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {usersSharedWithOverlay && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg  w-full max-w-[90%] sm:max-w-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold  dark:text-white">
                            Shared With Users
                        </h3>
                        <button
                            onClick={() => setUsersSharedWithOverlay(false)}
                            className="text-red-500 px-2 py-1 !border-none rounded-sm cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {sharedWithUsers.length > 0 && (
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
                            {sharedWithUsers.length} user
                            {sharedWithUsers.length > 1 ? "s" : ""}
                        </p>
                    )}

                    <div className="space-y-3">
                        {sharedWithUsers.map((user, index) => (
                            <div
                                className={
                                    "py-2 px-2 border-b first:border-t text-lg flex items-center gap-2 justify-between"
                                }
                                key={index}
                            >
                                <h4 className="text-lg">{user.nickname}</h4>
                                <button
                                    onClick={() =>
                                        handleRevokeShare(
                                            listId,
                                            user.ID,
                                            userToken
                                        )
                                    }
                                    className="text-gray-500 dark:text-gray-400 group hover:!border-red-500 duration-200 text-base transition-colors hover:!text-red-500 px-2 py-1 rounded-sm cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-3"
                                >
                                    Revoke Share
                                    <MinusIcon
                                        className="w-5 h-5 group-hover:text-red-500 duration-200 transition-colors"
                                        strokeWidth={2}
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShareListDialog;
