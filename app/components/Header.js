import Link from "next/link";
import Navigation from "./Navigation";
import {useState, useEffect} from "react";
import dynamic from "next/dynamic";

// Dynamically import the Settings icon with no SSR
const Settings = dynamic(
    () => import("lucide-react").then((mod) => mod.Settings),
    {ssr: false}
);

// Helpers
import {extractUserName} from "../lib/helpers";
import UserSettings from "./UserSettings";

export default function Header({isRegistered, userName}) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <>
            {/* normal header */}
            {!isRegistered && <Navigation route={"/login"} link={"Login"} />}

            {/* Register user Navigation */}
            {isRegistered && (
                <div
                    className={
                        "py-4 md:py-6 px-4 md:px-8 xl:px-16 flex justify-between items-center gap-12"
                    }
                >
                    <Link
                        id="site-logo"
                        href={"/"}
                        className={"font-bold font-saira uppercase text-3xl"}
                    >
                        Lista
                    </Link>
                    <div className="flex items-center gap-4">
                        {/* Clickable Username for Settings */}
                        <div className="flex items-center  gap-4">
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="text-white flex cursor-pointer username items-center border user-settings-button gap-2 px-3 py-1.5 rounded-lg transition-colors duration-200"
                                aria-label="Open settings"
                            >
                                <span className="inline-block font-saira wave-emoji">
                                    👋
                                </span>
                                <span className="text-sm md:text-base custom-text-color font-saira">
                                    {extractUserName(userName)}
                                </span>
                            </button>
                        </div>

                        {/* Logout Button */}
                        <Link
                            href={"/logout"}
                            className="text-primary py-2 px-4 md:py-3 md:px-6 xl:px-8 text-xs md:text-sm group font-bold rounded-full bg-blue-800 relative"
                        >
                            <p className="relative z-20 text-white group-hover:text-black duration-700">
                                Logout
                            </p>
                            <div className="absolute w-0 h-0 rounded-full group-hover:w-full group-hover:h-full transition-all top-[50%] z-10 left-[50%] -translate-x-1/2 -translate-y-1/2 duration-200 bg-primary"></div>
                        </Link>
                    </div>

                    {/* Settings Modal */}
                    <UserSettings
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                    />
                </div>
            )}
        </>
    );
}
