import Link from "next/link";
import {useState} from "react";
import {ChevronDown, LogOut} from "lucide-react";
import {extractUserName} from "../lib/helpers";
import UserSettings from "./UserSettings";
import {useUserContext} from "../contexts/UserContext";

export default function Header({isRegistered, userName}) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const session = useUserContext();
    const registered = session.isRegistered ?? isRegistered;
    return (
        <>
            <div className="app-navigation">
                <Link id="site-logo" href="/" className="font-bold font-saira uppercase text-3xl">Lista</Link>
                <div className="app-account-actions">
                    <button onClick={() => setIsSettingsOpen(true)} className={`app-account-button ${registered ? "" : "is-guest"}`} aria-label="Open account settings" aria-haspopup="dialog" aria-expanded={isSettingsOpen}>
                        <span className="app-account-avatar" aria-hidden="true">👋</span>
                        <span className="app-account-name">{registered ? extractUserName(session.accountName || userName) || "Account" : "Guest"}</span>
                        <ChevronDown size={15} aria-hidden="true" />
                    </button>
                    {registered
                        ? <Link href="/logout" className="app-primary-action app-logout-button"><LogOut size={16} aria-hidden="true" /><span>Logout</span></Link>
                        : <Link href="/login" className="app-primary-action">Login</Link>}
                </div>
            </div>
            <UserSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
    );
}
