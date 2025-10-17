import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage({searchParams}) {
    const cookieStore = cookies();
    const cookieToken = cookieStore.get("token")?.value;
    const registered = cookieStore.get("registered")?.value;

    const token = searchParams?.token || null;
    const key = searchParams?.key || null;
    const login = searchParams?.login || null;

    // If no valid params are present, redirect to login
    if (!token && !(key && login)) {
        redirect("/login");
    }

    // If already registered/logged in and token flow present, send home
    if (cookieToken && registered === "yes") {
        redirect("/");
    }

    return <ResetPasswordClient token={token} resetKey={key} login={login} />;
}
