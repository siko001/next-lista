// app/hooks/useAuth.js
"use client";
import {SessionProvider} from "next-auth/react";

export function AuthProvider({children}) {
    return <SessionProvider>{children}</SessionProvider>;
}

export {useSession} from "next-auth/react";
