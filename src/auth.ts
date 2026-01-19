import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
    session: {
        strategy: "jwt",
        maxAge: 60 * 60, // 1 hour - force session refresh
    },
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    scope: 'openid email profile https://www.googleapis.com/auth/gmail.send',
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (!user.email) return false;

            try {
                // Check if user exists
                let dbUser = await prisma.user.findUnique({
                    where: { email: user.email }
                });

                // Create user if doesn't exist
                if (!dbUser) {
                    dbUser = await prisma.user.create({
                        data: {
                            email: user.email,
                            name: user.name,
                            image: user.image,
                            emailVerified: new Date(),
                        }
                    });
                }

                // Check if account exists
                if (account) {
                    const existingAccount = await prisma.account.findUnique({
                        where: {
                            provider_providerAccountId: {
                                provider: account.provider,
                                providerAccountId: account.providerAccountId
                            }
                        }
                    });

                    // Create or update account
                    if (!existingAccount) {
                        await prisma.account.create({
                            data: {
                                userId: dbUser.id,
                                type: account.type,
                                provider: account.provider,
                                providerAccountId: account.providerAccountId,
                                refresh_token: account.refresh_token,
                                access_token: account.access_token,
                                expires_at: account.expires_at,
                                token_type: account.token_type,
                                scope: account.scope,
                                id_token: account.id_token,
                                session_state: account.session_state as string | null,
                            }
                        });
                    } else {
                        // Update existing account with new tokens
                        await prisma.account.update({
                            where: {
                                provider_providerAccountId: {
                                    provider: account.provider,
                                    providerAccountId: account.providerAccountId
                                }
                            },
                            data: {
                                refresh_token: account.refresh_token,
                                access_token: account.access_token,
                                expires_at: account.expires_at,
                                scope: account.scope,
                                id_token: account.id_token,
                                session_state: account.session_state as string | null,
                            }
                        });
                    }
                }

                return true;
            } catch (error) {
                console.error("[Auth] Error in signIn callback:", error);
                return false;
            }
        },
        async jwt({ token, account, user }) {
            // Initial sign in
            if (account && user) {
                return {
                    ...token,
                    accessToken: account.access_token,
                    refreshToken: account.refresh_token,
                    expiresAt: Date.now() + ((account.expires_in as number) * 1000), // expires_in is in seconds
                    id: user.id,
                };
            }

            // Return previous token if the access token has not expired yet
            if (Date.now() < (token.expiresAt as number)) {
                return token;
            }

            // Access token has expired, try to update it
            console.log("[Auth] Access token expired, refreshing...");
            return await refreshAccessToken(token);
        },
        async session({ session, token }) {
            console.log('[Auth] Session callback triggered')
            if (token) {
                if (session.user) {
                    session.user.id = token.id as string;
                    (session.user as any).department = "Unassigned"; // Default, updated below
                    (session.user as any).roles = ["USER"]; // Default
                }

                // Add access token to session
                (session as any).accessToken = token.accessToken;
                (session as any).error = token.error;

                // Fetch fresh user data from DB to ensure roles/dept are up to date
                if (token.id) {
                    console.log('[Auth] Fetching user from DB:', token.id)
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        include: { department: true }
                    }) as any;

                    console.log('[Auth] DB User found:', dbUser?.email, 'Roles:', dbUser?.roles)

                    if (dbUser && session.user) {
                        (session.user as any).department = dbUser.department?.name || "Unassigned";
                        (session.user as any).roles = dbUser.roles || [dbUser.role] || ["USER"];
                        (session.user as any).managerId = dbUser.managerId;
                        console.log('[Auth] Updated session roles to:', (session.user as any).roles)
                    }
                }
            }
            return session;
        },
    },
})

async function refreshAccessToken(token: any) {
    try {
        if (!token.refreshToken) {
            console.error("[Auth] No refresh token available in the session. User needs to sign in again via Google.");
            return {
                ...token,
                error: "RefreshAccessTokenError",
            }
        }

        const url =
            "https://oauth2.googleapis.com/token?" +
            new URLSearchParams({
                client_id: process.env.AUTH_GOOGLE_ID!,
                client_secret: process.env.AUTH_GOOGLE_SECRET!,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
            })

        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
        })

        const refreshedTokens = await response.json()

        if (!response.ok) {
            throw refreshedTokens
        }

        console.log("[Auth] Token refreshed successfully");

        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            expiresAt: Date.now() + refreshedTokens.expires_in * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
        }
    } catch (error) {
        console.error("[Auth] Error refreshing access token", error)

        return {
            ...token,
            error: "RefreshAccessTokenError",
        }
    }
}
