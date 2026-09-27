import Link from "next/link";
import Navigation from "./Navigation";
import {useState} from "react";
import {ChevronDown, LogOut} from "lucide-react";
import {extractUserName} from "../lib/helpers";
import UserSettings from "./UserSettings";
import {useUserContext} from "../contexts/UserContext";

export default function Header({isRegistered, userName}) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const session = useUserContext();
    if (!(session.isRegistered ?? isRegistered)) return <Navigation route="/login" link="Login" />;
    return (
        <>
            <div className="app-navigation">
                <Link id="site-logo" href="/" className="font-bold font-saira uppercase text-3xl">Lista</Link>
                <div className="app-account-actions">
                    <button onClick={() => setIsSettingsOpen(true)} className="app-account-button" aria-label="Open account settings" aria-haspopup="dialog" aria-expanded={isSettingsOpen}>
                        <span className="app-account-avatar" aria-hidden="true">👋</span>
                        <span className="app-account-name">{extractUserName(session.accountName || userName) || "Account"}</span>
                        <ChevronDown size={15} aria-hidden="true" />
                    </button>
                    <Link href="/logout" className="app-primary-action app-logout-button"><LogOut size={16} aria-hidden="true" /><span>Logout</span></Link>
                </div>
            </div>
            <UserSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
    );
}
