import {Component, useEffect, useState} from "react";
import {UserProvider, useUserContext} from "../../app/contexts/UserContext";
import {OverlayProvider} from "../../app/contexts/OverlayContext";
import {NotificationProvider} from "../../app/contexts/NotificationContext";
import {ValidationProvider} from "../../app/contexts/ValidationContext";
import {ListProvider} from "../../app/contexts/ListContext";
import {LoadingProvider} from "../../app/contexts/LoadingContext";
import {ProductProvider} from "../../app/contexts/ProductContext";
import AssistantAddProgress from "../../app/components/AssistantAddProgress";
import HomeClient from "../../app/HomeClient";
import ShoppingList from "../../app/list/[id]/ShoppingList";
import SharedListClient from "../../app/shared-list/[id]/SharedListClient";
import LoginClient from "../../app/login/LoginClient";
import RegisterClient from "../../app/register/RegisterClient";
import LogoutClient from "../../app/logout/LogoutClient";
import PasswordResetClient from "../../app/password-reset/PasswordResetClient";
import ResetPasswordClient from "../../app/reset-password/ResetPasswordClient";
import NotFound from "../../app/not-found";
import PageSkeleton from "../../app/components/loaders/PageSkeleton";
import {getAllProducts, WP_API_BASE} from "../../app/lib/helpers";
import {getCookie} from "./session.js";
import {useLocation, useParams, router} from "./compat/navigation.js";
import {reloadPage} from "./platform.js";

const EMPTY_METADATA = {};
export function ErrorScreen({message, retry = reloadPage, login = false}) {
    return <main className="mobile-message"><div className="mobile-message-card">
        <span className="mobile-wordmark">LISTA</span>
        <h1>Let’s get you connected.</h1>
        <p role="alert">{message}</p>
        <button className="app-primary-action" onClick={retry}>Try again</button>
        {login && <button className="app-secondary-action" onClick={() => router.push("/login")}>Log in</button>}
        <button className="app-secondary-action" onClick={() => router.replace("/")}>Back to your lists</button>
    </div></main>;
}

class ErrorBoundary extends Component {
    state = {error: false};
    static getDerivedStateFromError() { return {error: true}; }
    render() { return this.state.error ? <ErrorScreen message="Lista couldn’t open this screen. Please try again." /> : this.props.children; }
}

function HomePage({session}) {
    const [lists, setLists] = useState(null);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setError("");
        fetch(`${WP_API_BASE}/custom/v1/shopping-lists-by-owner/${session.userData.id}`, {
            headers: {Authorization: `Bearer ${session.token}`}, cache: "no-store", signal: controller.signal,
        }).then(async (response) => {
            if (!response.ok) throw new Error("We couldn’t load your lists. Check your connection and try again.");
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error("We couldn’t load your lists. Please try again.");
            if (!controller.signal.aborted) setLists(data.filter((list) =>
                String(list.acf?.owner_id) === String(session.userData.id) ||
                (Array.isArray(list.acf?.shared_with_users) && list.acf.shared_with_users.some((user) => String(user.ID) === String(session.userData.id)))
            ).sort((a, b) => a.menu_order - b.menu_order));
        }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
        return () => controller.abort();
    }, [session.userData.id, session.token, attempt]);
    if (error) return <ErrorScreen message={error} retry={() => setAttempt((value) => value + 1)} login />;
    if (!lists) return <PageSkeleton />;
    return <HomeClient isRegistered={session.isRegistered} userName={session.accountName}
        userId={session.userData.id} lists={lists} serverToken={getCookie("token") || session.token} metadata={EMPTY_METADATA} />;
}

function ListPage({session}) {
    const {id} = useParams();
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setResult(null); setError("");
        const load = async () => {
            try {
                const options = {headers: {Authorization: `Bearer ${session.token}`}, cache: "no-store", signal: controller.signal};
                const [details, products, catalogue] = await Promise.all([
                    fetch(`${WP_API_BASE}/custom/v1/shopping-list/${id}`, options),
                    fetch(`${WP_API_BASE}/custom/v1/get-shopping-list-products?shoppingListId=${id}`, options),
                    getAllProducts(session.token, {strict: true}),
                ]);
                if (details.status === 404 || details.status === 403) throw new Error("This list is no longer available to your account.");
                if (!details.ok || !products.ok) throw new Error("We couldn’t load this list. Check your connection and try again.");
                const [list, items] = await Promise.all([details.json(), products.json()]);
                if (!list || !items.success || !Array.isArray(items.linkedProducts)) throw new Error("We couldn’t load this list. Please try again.");
                if (!controller.signal.aborted) setResult({list, items, catalogue});
            } catch (failure) {
                if (!controller.signal.aborted) setError(failure.message || "Check your connection and try again.");
            }
        };
        void load();
        return () => controller.abort();
    }, [id, session.token, attempt]);
    if (error) return <ErrorScreen message={error} retry={() => setAttempt((value) => value + 1)} />;
    if (!result) return <PageSkeleton detail />;
    return <ShoppingList key={id} listId={id} userId={session.userData.id}
        isRegistered={session.isRegistered} userName={session.accountName}
        token={getCookie("token") || session.token} list={result.list}
        baggedItems={result.items} checkedProductList={result.items.checkedProducts || []}
        AllProducts={result.catalogue} userCustomProducts={null} favourites={null}
        ownerName={result.list.owner_name} />;
}

function Redirect({to}) {
    useEffect(() => router.replace(to), [to]);
    return null;
}

function Routes() {
    const location = useLocation();
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    const session = useUserContext();
    const signedIn = session.isRegistered && !!session.token && !session.error;
    const isAuth = ["/login", "/register", "/password-reset", "/reset-password"].includes(path);
    if (isAuth && signedIn) return <Redirect to="/" />;
    if (path === "/login") return <LoginClient />;
    if (path === "/register") return <RegisterClient />;
    if (path === "/password-reset") return <PasswordResetClient />;
    if (path === "/reset-password") {
        const query = new URLSearchParams(window.location.search);
        if (!query.get("token") && !(query.get("key") && query.get("login"))) return <Redirect to="/login" />;
        return <ResetPasswordClient token={query.get("token")} resetKey={query.get("key")} login={query.get("login")} />;
    }
    if (path === "/logout") return <LogoutClient />;
    if (session.loading) return <PageSkeleton detail={/^\/list\//.test(path)} />;
    if (session.error || !session.userData || !session.token) return <ErrorScreen message={session.error || "Check your connection and try again."} login />;
    if (path === "/") return <HomePage key={location} session={session} />;
    if (/^\/list\/\d+$/.test(path)) return <ListPage key={location} session={session} />;
    const shared = path.match(/^\/shared-list\/(\d+)$/);
    if (shared) return <SharedListClient key={location} listId={shared[1]} token={session.token} userId={session.userData.id} />;
    return <NotFound />;
}

function MobileStatus() {
    const [offline, setOffline] = useState(!navigator.onLine);
    const [error, setError] = useState("");
    useEffect(() => {
        const online = () => setOffline(false);
        const disconnected = () => setOffline(true);
        const failed = (event) => setError(event.detail);
        window.addEventListener("online", online);
        window.addEventListener("offline", disconnected);
        window.addEventListener("lista:mobile-error", failed);
        return () => { window.removeEventListener("online", online); window.removeEventListener("offline", disconnected); window.removeEventListener("lista:mobile-error", failed); };
    }, []);
    if (!offline && !error) return null;
    return <div className="mobile-status" role="status">{error || "You’re offline. Reconnect to update and share your lists."}
        {error && <button aria-label="Dismiss message" onClick={() => setError("")}>×</button>}
    </div>;
}

export default function App() {
    return <ErrorBoundary><LoadingProvider><NotificationProvider><ListProvider>
        <UserProvider initialRegistered={getCookie("registered") === "yes"} initialUserName={getCookie("username")}>
            <ProductProvider><ValidationProvider><OverlayProvider>
                <MobileStatus /><AssistantAddProgress /><Routes />
            </OverlayProvider></ValidationProvider></ProductProvider>
        </UserProvider>
    </ListProvider></NotificationProvider></LoadingProvider></ErrorBoundary>;
}
