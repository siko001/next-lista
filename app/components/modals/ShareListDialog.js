
const ShareListDialog = ({ listId, onClose }) => {
    // const [showOptions, setShowOptions] = useState(false);
    const listUrl = `${window.location.origin}/shared-list/${listId}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Check out this shopping list: ${listUrl}`)}`;
    const messengerUrl = `fb-messenger://share?link=${encodeURIComponent(listUrl)}`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(listUrl);
        alert('Link copied to clipboard!');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full">
                <h3 className="text-lg font-bold mb-4 dark:text-white">Share List</h3>

                <div className="space-y-3">
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                        {/* <WhatsAppIcon className="w-5 h-5 mr-2" /> */}
                        Share via WhatsApp
                    </a>

                    <a href={messengerUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        {/* <MessengerIcon className="w-5 h-5 mr-2" /> */}
                        Share via Messenger
                    </a>

                    <button onClick={copyToClipboard}
                        className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 w-full">
                        {/* <CopyIcon className="w-5 h-5 mr-2" /> */}
                        Copy Link
                    </button>
                </div>

                <button onClick={onClose} className="mt-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default ShareListDialog;