export {default} from "next-auth/middleware";

export const config = {
    matcher: ["/dashboard/:path*"], // Protect all routes under /dashboard
};
