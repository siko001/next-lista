import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import PasswordResetClient from "./PasswordResetClient";
export default function Page() {
    const cookieStore = cookies();
    const cookieToken = cookieStore.get("token")?.value;
    const registered = cookieStore.get("registered")?.value;

    // If already registered/logged in, send home
    if (cookieToken && registered === "yes") {
        redirect("/");
    }
    return <PasswordResetClient />;
}
