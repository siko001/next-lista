'use client'
import { useEffect } from "react";
import { useUserContext } from "../contexts/UserContext";

export default function LogoutClient() {
    const { logout } = useUserContext();

    useEffect(() => {
        setTimeout(() => {
            logout();
            window.location.href = "/";
        }, 1500);
        return () => {
            clearTimeout();
        };
    });
    // Nicer logout page maybe spinner
    return (
        <main>
            <div className="flex flex-col items-center justify-center h-screen">
                <h1 className="text-3xl font-bold mb-4">Logging out...</h1>
                <p className="text-lg">You will be redirected shortly.</p>
            </div>
        </main>
    );
}