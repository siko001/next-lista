"use client";
import {useEffect, useRef, useState} from "react";
import {useUserContext} from "../contexts/UserContext";
import LogoutScreen from "../components/auth/LogoutScreen";

export default function LogoutClient() {
    const {logout} = useUserContext();
    const logoutRef = useRef(logout);
    logoutRef.current = logout;
    const [leaving, setLeaving] = useState(false);
    useEffect(() => {
        const fade = setTimeout(() => setLeaving(true), 1200);
        const redirect = setTimeout(() => {
            logoutRef.current();
            window.location.replace("/");
        }, 1500);
        return () => { clearTimeout(fade); clearTimeout(redirect); };
    }, []);
    return <LogoutScreen leaving={leaving} />;
}
