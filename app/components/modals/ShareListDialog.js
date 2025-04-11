'use client'
import WhatsAppIcon from '../svgs/WhatsappIcon'
import MessengerIcon from '../svgs/MessengerIcon'
import LinkIcon from '../svgs/LinkIcon'
import { useNotificationContext } from '../../contexts/NotificationContext'
import { useEffect } from 'react'

const ShareListDialog = ({ listId, onClose }) => {
    const { showNotification } = useNotificationContext();
    const listUrl = `${window.location.origin}/shared-list/${listId}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Sharing this list with you: ${listUrl}`)}`;
    // const messengerUrl = `fb-messenger://share?link=${encodeURIComponent(listUrl)}`;
    function shareOnMessenger(listUrl) {
        const encodedUrl = encodeURIComponent(listUrl);

        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            window.location.href = `fb-messenger://share?link=${encodedUrl}`;
            setTimeout(() => {
                window.location.href = `https://m.me/share?u=${encodedUrl}`;
            }, 500);
        } else {
            window.open(`https://www.facebook.com/dialog/send?link=${encodedUrl}&redirect_uri=${encodeURIComponent(window.location.href)}`, '_blank');
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
            if (event.target.classList.contains('fixed')) {
                onClose();
            }
        };
        // close on escape key press
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };



        // add event listener to close modal if clicked outside
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        // cleanup function to remove event listener
        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    })



    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg  w-full max-w-[90%] sm:max-w-sm">
                <h3 className="text-lg font-bold mb-4 dark:text-white">Share List</h3>

                <div className="space-y-3">
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                        className="flex cursor-pointer items-center px-4 py-2 bg-green-700 text-white rounded hover:bg-green-600">
                        <WhatsAppIcon className={"w-7 h-7 mr-2"} />
                        Share via WhatsApp
                    </a>

                    <a onClick={shareOnMessenger} target="_blank" rel="noopener noreferrer"
                        className="flex cursor-pointer items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        <MessengerIcon className={"w-8 h-8 mr-2"} />
                        Share via Messenger
                    </a>

                    <button onClick={copyToClipboard}
                        className="flex cursor-pointer items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 w-full">
                        <LinkIcon className="w-7 h-7 mr-3" />
                        Copy Link
                    </button>
                </div>

                <button onClick={onClose} className="mt-4 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-sm cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default ShareListDialog;