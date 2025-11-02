// app/components/AuthCheck.js
"use client";

import {useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {useEffect} from "react";

export default function AuthCheck({children}) {
    const {data: session, status} = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    if (status === "loading") {
        return <div>Loading...</div>; // Or your loading component
    }

    if (status === "authenticated") {
        return <>{children}</>;
    }

    return null;
}
