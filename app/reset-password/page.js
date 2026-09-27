import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import ResetPasswordClient from "./ResetPasswordClient";

export default async function ResetPasswordPage({searchParams}) {
    const cookieStore = await cookies();
    const query = await searchParams;
    const cookieToken = cookieStore.get("token")?.value;
    const registered = cookieStore.get("registered")?.value;

    const token = query?.token || null;
    const key = query?.key || null;
    const login = query?.login || null;

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
