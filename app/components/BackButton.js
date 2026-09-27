"use client";

import {ArrowLeft} from "lucide-react";
import {useRouter} from "next/navigation";

export default function BackButton() {
    const router = useRouter();
    return <button type="button" className="missing-secondary" onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/");
    }}><ArrowLeft size={18} aria-hidden="true" /> Previous page</button>;
}
