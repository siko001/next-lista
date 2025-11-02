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
    const {userData, loading} = useUserContext();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, [userData, loading]);

    return (
        <div
            className={
                " py-4 md:py-6 px-4 md:px-8 xl:px-16 flex justify-between items-center gap-12"
            }
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

                {!loading && !(userData && userData.registered === "yes") && (
                    <Link
                        href={`${props.route}`}
                        className={
                            "text-primary overflow-hidden  group relative py-3 px-6 xl:px-10 font-bold rounded-full bg-blue-800"
                        }
                    >
                        <p className="relative z-20 group-hover:text-black duration-700 text-white">
                            {props.link}
                        </p>
                        <div className="absolute w-0 h-0 group-hover:w-full group-hover:h-full transition-all top-[50%] z-10 left-[50%] -translate-x-1/2 -translate-y-1/2 duration-200 bg-primary"></div>
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
