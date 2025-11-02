import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        async signIn({user, account, profile, cookies}) {
            // Allow sign in; WordPress integration happens client-side after login
            return true;
        },
        async jwt({token, user, account, trigger}) {
            // Initial sign in
            if (account && user) {
                return {
                    ...token,
                    accessToken: account.access_token,
                    wpJwt: user.wpJwt,
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                        isLoggedIn: true,
                        wpUser: user.wpUser,
                    },
                };
            }
            return token;
        },
        async session({session, token}) {
            // Add user data from token to session
            session.user = {
                ...session.user,
                id: token.sub || token.id,
                isLoggedIn: true,
                wpUser: token.user?.wpUser,
            };

            if (token.accessToken) {
                session.accessToken = token.accessToken;
            }

            if (token.wpJwt) {
                session.wpJwt = token.wpJwt;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    secret: process.env.NEXTAUTH_SECRET,
    debug: process.env.NODE_ENV === "development",
};
