"use client";

import {usePathname} from "next/navigation";
import PageSkeleton from "./components/loaders/PageSkeleton";
import AuthSkeleton from "./components/loaders/AuthSkeleton";
import LogoutScreen from "./components/auth/LogoutScreen";

export default function Loading() {
    const pathname = usePathname();
    if (pathname === "/logout") return <LogoutScreen />;
    if (pathname === "/password-reset" || pathname === "/reset-password") {
        return <AuthSkeleton mode={pathname === "/password-reset" ? "forgot" : "reset"} />;
    }
    if (pathname === "/login" || pathname === "/register") {
        return <AuthSkeleton register={pathname === "/register"} />;
    }
    return <PageSkeleton detail={pathname?.startsWith("/list/")} />;
}
