"use client";
import {useState, useEffect, useRef} from "react";
import WhatsAppIcon from "../svgs/WhatsappIcon";
import MessengerIcon from "../svgs/MessengerIcon";
import LinkIcon from "../svgs/LinkIcon";
import {useNotificationContext} from "../../contexts/NotificationContext";
import {useUserContext} from "../../contexts/UserContext";
import {useListContext} from "../../contexts/ListContext";
import BinocularIcon from "../svgs/BinocularIcon";
import CloseIcon from "../svgs/CloseIcon";
import MinusIcon from "../svgs/MinusIcon";
import {
    removeListRelationship,
    WP_API_BASE,
    isListOwner,
    decryptToken,
} from "../../lib/helpers";
import Pusher from "pusher-js";

const ShareListDialog = ({
    listId,
    onClose,
    sharedWithUsers,
    token,
    setSharedWithUsers,
    userId,
    list,
    initialView = "share",
}) => {
    const dialogRef = useRef(null);
    const {showNotification} = useNotificationContext();
    const {userLists, setUserLists, lenis} = useListContext();
    const {token: userToken} = useUserContext();

    const [shareCode, setShareCode] = useState(null);
    const [generatingTarget, setGeneratingTarget] = useState(null); // 'whatsapp' | 'messenger' | 'copy' | null

    const listUrlBase = `${
        typeof window !== "undefined" ? window.location.origin : ""
    }/shared-list/${listId}`;
    const listUrlWithCode = shareCode
        ? `${listUrlBase}?k=${shareCode}`
        : listUrlBase;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
        `Sharing this list with you: ${listUrlWithCode}`
    )}`;

    const FB_APP_ID = process.env.NEXT_PUBLIC_FB_APP_ID;
    function shareOnMessenger(urlToShare) {
        const encodedUrl = encodeURIComponent(urlToShare);
        const isMobile =
            /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            );

        // Desktop with App ID: use Facebook Send Dialog
        if (!isMobile && FB_APP_ID) {
            const redirect = encodeURIComponent(
                `${window.location.origin}/share-complete`
            );
            const dialogUrl = `https://www.facebook.com/dialog/send?app_id=${FB_APP_ID}&link=${encodedUrl}&redirect_uri=${redirect}&display=popup`;
            window.open(dialogUrl, "_blank", "noopener,noreferrer");
            return;
        }

        // Mobile: try native Messenger, then web fallback
        if (isMobile) {
            window.location.href = `fb-messenger://share?link=${encodedUrl}`;
            setTimeout(() => {
                window.location.href = `https://m.me/?link=${encodedUrl}`;
            }, 500);
            return;
        }

        // Desktop fallback without app id: open Facebook sharer
        window.open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            "_blank",
            "noopener,noreferrer"
        );
    }

    const ensureShareCode = async (target) => {
        if (shareCode) return shareCode;
        if (generatingTarget) return null;
        try {
            setGeneratingTarget(target || "unknown");
            const decrypted = decryptToken(token);
            const res = await fetch(
                `${WP_API_BASE}/custom/v1/generate-share-code`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${decrypted}`,
                    },
                    body: JSON.stringify({list_id: listId}),
                }
            );
            const data = await res.json();
            if (!res.ok || !data?.success || !data?.code) {
                throw new Error(
                    data?.message || "Failed to generate share code"
                );
            }
            setShareCode(data.code);
            return data.code;
        } catch (e) {
            showNotification("Could not generate share link", "error");
            return null;
        } finally {
            setGeneratingTarget(null);
        }
    };

    const copyToClipboard = async () => {
        const code = await ensureShareCode("copy");
        if (!code) return;
        try {
            await navigator.clipboard.writeText(`${listUrlBase}?k=${code}`);
            showNotification("Link copied to clipboard!", "success", 3000);
            onClose();
        } catch {
            showNotification("Could not copy link. Please try again.", "error");
        }
    };

    useEffect(() => {
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        const pageScroller = lenis?.current;
        const wasStopped = pageScroller?.isStopped;
        pageScroller?.stop();
        document.body.style.overflow = "hidden";
        dialogRef.current?.querySelector("button")?.focus({preventScroll: true});
        return () => {
            document.body.style.overflow = previousOverflow;
            if (!wasStopped) pageScroller?.start();
            if (previousFocus?.isConnected) previousFocus.focus({preventScroll: true});
        };
    }, [lenis]);

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
            if (event.key === "Tab") {
                const controls = dialogRef.current?.querySelectorAll("button:not(:disabled), a[href]");
                if (!controls?.length) return;
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
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

    const [usersSharedWithOverlay, setUsersSharedWithOverlay] = useState(initialView === "members");
    const handleSeeUsersSharedWith = () => {
        setUsersSharedWithOverlay(true);
    };

    const [localSharedUsers, setLocalSharedUsers] = useState(
        sharedWithUsers || []
    );

    useEffect(() => {
        setLocalSharedUsers(sharedWithUsers || []);
    }, [sharedWithUsers]);

    const handleRevokeShare = async (listId, removedUserId, token) => {
        try {
            const res = await fetch(
                `${WP_API_BASE}/custom/v1/remove-user-from-shared`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        listId,
                        userId: removedUserId,
                        notifyUsers: {
                            removedUserId,
                            ownerId: list?.acf?.owner_id,
                            sharedUserIds: localSharedUsers
                                .filter((user) => user.ID !== removedUserId)
                                .map((user) => user.ID),
                        },
                    }),
                }
            );

            const data = await res.json();

            if (data.message === "User removed from shared list") {
                // Update local shared users state
                const updatedUsers = (localSharedUsers || []).filter(
                    (user) => user.ID !== removedUserId
                );

                setLocalSharedUsers(updatedUsers);
                setSharedWithUsers(updatedUsers);

                // Update the userLists state to reflect the change in shared_with_users
                setUserLists((prevLists) => {
                    return prevLists.map((prevList) => {
                        if (parseInt(prevList.id) === parseInt(listId)) {
                            return {
                                ...prevList,
                                acf: {
                                    ...prevList.acf,
                                    shared_with_users: updatedUsers,
                                },
                            };
                        }
                        return prevList;
                    });
                });

                // Force a re-render of the parent list
                const updatedList = {
                    ...list,
                    acf: {
                        ...list.acf,
                        shared_with_users: updatedUsers,
                    },
                };

                if (updatedUsers.length === 0) {
                    setUsersSharedWithOverlay(false);
                    onClose();
                }
            }
        } catch (error) {
            console.error("Error removing user:", error);
            showNotification("Failed to remove user", "error");
        }
    };

    // Sync local state with parent state
    useEffect(() => {
        if (sharedWithUsers) {
            setLocalSharedUsers(sharedWithUsers);
        }
    }, [sharedWithUsers]);

    return (
        <>
            <div className="app-dialog-backdrop fixed inset-0 z-50" />
            <div className="app-dialog-layer fixed inset-0 grid place-items-center z-50" data-lenis-prevent>
                {!usersSharedWithOverlay && (
                    <section ref={dialogRef} className="app-dialog lista-share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-list-title">
                        <button type="button" className="app-dialog-close" onClick={onClose} aria-label="Close sharing dialog"><CloseIcon className="w-6 h-6" /></button>
                        <div className="app-dialog-heading">
                            <p className="app-dialog-eyebrow">SHOP TOGETHER</p>
                            <h2 id="share-list-title">Share your list</h2>
                            <p className="app-dialog-description">Send a link and keep your shopping in sync.</p>
                        </div>
                        <div className="share-options">
                            <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="share-option share-option-whatsapp" aria-disabled={!!generatingTarget}
                                onClick={async (e) => {
                                    e.preventDefault();
                                    const code = await ensureShareCode(
                                        "whatsapp"
                                    );
                                    if (!code) return;
                                    const url = `https://wa.me/?text=${encodeURIComponent(
                                        `Sharing this list with you: ${listUrlBase}?k=${code}`
                                    )}`;
                                    window.open(
                                        url,
                                        "_blank",
                                        "noopener,noreferrer"
                                    );
                                }}
                            >
                                <span className="share-option-icon"><WhatsAppIcon /></span>
                                <span className="share-option-text"><strong>{generatingTarget === "whatsapp" ? "Preparing link…" : "WhatsApp"}</strong><small>Send to a chat or group</small></span>
                            </a>

                            <button
                                type="button"
                                onClick={async () => {
                                    const code = await ensureShareCode(
                                        "messenger"
                                    );
                                    if (!code) return;
                                    shareOnMessenger(`${listUrlBase}?k=${code}`);
                                }}
                                className="share-option share-option-messenger"
                                disabled={!!generatingTarget}
                            >
                                <span className="share-option-icon"><MessengerIcon /></span>
                                <span className="share-option-text"><strong>{generatingTarget === "messenger" ? "Preparing link…" : "Messenger"}</strong><small>Share with your friends</small></span>
                            </button>

                            <button
                                onClick={copyToClipboard}
                                className="share-option share-option-link"
                                disabled={!!generatingTarget}
                            >
                                <span className="share-option-icon"><LinkIcon /></span>
                                <span className="share-option-text"><strong>{generatingTarget === "copy" ? "Preparing link…" : "Copy link"}</strong><small>Paste it wherever you like</small></span>
                            </button>
                            {sharedWithUsers?.length > 0 &&
                                isListOwner(list, userId) && (
                                    <button
                                        onClick={handleSeeUsersSharedWith}
                                        className="share-option share-option-members"
                                    >
                                        <span className="share-option-icon"><BinocularIcon /></span>
                                        <span className="share-option-text"><strong>Manage access</strong><small>{localSharedUsers.length} people sharing this list</small></span>
                                    </button>
                                )}
                        </div>

                        <div className="app-dialog-actions"><button type="button" onClick={onClose} className="app-secondary-action">Done</button></div>
                    </section>
                )}

                {usersSharedWithOverlay && (
                    <div ref={dialogRef} className="app-dialog lista-share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-members-title">
                        <div className="app-dialog-heading">
                            <p className="app-dialog-eyebrow">SHOP TOGETHER</p>
                            <h2 id="share-members-title">Manage access</h2>
                            <p className="app-dialog-description">People who can shop with you on this list.</p>
                            <button
                                type="button"
                                onClick={initialView === "members" ? onClose : () => setUsersSharedWithOverlay(false)}
                                className="app-dialog-close"
                                aria-label={initialView === "members" ? "Close access manager" : "Back to sharing options"}
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <p className="share-members-count">{localSharedUsers.length} {localSharedUsers.length === 1 ? "person" : "people"} with access</p>

                        <div className="share-members-list">
                            {localSharedUsers.map((user) => (
                                <div
                                    className="share-member-row"
                                    key={user.ID}
                                >
                                    <span className="share-member-avatar" aria-hidden="true">{(user.display_name || "?").trim().charAt(0).toUpperCase()}</span>
                                    <div className="share-member-info"><h4>{user.display_name}</h4><span>Can view and edit</span></div>
                                    <button
                                        onClick={() =>
                                            handleRevokeShare(
                                                listId,
                                                user.ID,
                                                userToken
                                            )
                                        }
                                        className="share-member-remove"
                                        aria-label={`Remove ${user.display_name} from this list`}
                                    >
                                        Remove access
                                        <MinusIcon
                                            className="w-5 h-5 group-hover:text-red-500 duration-200 transition-colors"
                                            strokeWidth={2}
                                        />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <p className="share-members-note">Changes to access take effect right away.</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default ShareListDialog;
