import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        async signIn({user, account, profile}) {
            try {
                // Exchange Google token for your WordPress JWT
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/wp-json/jwt-auth/v1/token`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            email: user.email,
                            username: user.email.split("@")[0],
                            password: account.id_token, // Using ID token as a password
                        }),
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    console.error("JWT Auth failed:", data);
                    return false;
                }

                // Store the WordPress JWT in the user object
                user.wpJwt = data.token;
                user.wpUser = data.user;

                return true;
            } catch (error) {
                console.error("Auth error:", error);
                return false;
            }
        },
        async jwt({token, user, account}) {
            // Initial sign in
            if (account && user) {
                return {
                    ...token,
                    accessToken: account.access_token,
                    wpJwt: user.wpJwt,
                    user: user.wpUser,
                };
            }
            return token;
        },
        async session({session, token}) {
            session.wpJwt = token.wpJwt;
            session.user = token.user;
            session.accessToken = token.accessToken;
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
