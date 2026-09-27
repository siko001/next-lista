import Link from "next/link";
import {useUserContext} from "../contexts/UserContext";
import {useState, useEffect} from "react";
import dynamic from "next/dynamic";

// Dynamically import the icons with no SSR
const Settings = dynamic(
    () => import("lucide-react").then((mod) => mod.Settings),
    {ssr: false}
);
const User = dynamic(() => import("lucide-react").then((mod) => mod.User), {
    ssr: false,
});
import UserSettings from "./UserSettings";

export default function Navigation(props) {
    const {userData, isRegistered} = useUserContext();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div
            className="app-navigation"
        >
            <Link
                id="site-logo"
                href={"/"}
                className={"font-bold font-saira uppercase text-3xl"}
            >
                Lista
            </Link>

            <div className="flex gap-4 items-center">
                {userData && userData.registered === "yes" && (
                    <div className={"flex items-center gap-4"}>
                        <div className="text-white flex custom-text-color items-center gap-2">
                            <span className="inline-block  font-saira wave-emoji">
                                👋
                            </span>
                            {userData?.name}
                        </div>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 rounded-full custom-text-color hover:bg-white/10 transition-colors duration-200"
                            aria-label="Settings"
                        >
                            <Settings className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {!isRegistered && (
                    <Link
                        href={`${props.route}`}
                        className="app-primary-action"
                    >
                        {props.link}
                    </Link>
                )}

                {/* Settings Button - Only show when user is logged in */}
                {mounted && userData?.registered === "yes" && (
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                        aria-label="User settings"
                    >
                        <Settings className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* User Settings Modal */}
            <UserSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
}
