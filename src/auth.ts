import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    session: {
        strategy: "jwt",
        maxAge: 60 * 60, // 1 hour - force session refresh
    },
    pages: {
        error: '/unauthorized',
    },
    callbacks: {
        async signIn({ user, account, profile }) {
            if (!user.email) return false;

            // 1. Domain Restriction Guardrail
            // DYNAMIC CHECK: Workspace Verification (Primary Domain + Aliases)
            // We check the 'hd' (Hosted Domain) claim. 
            // If a user logs in with an alias (e.g. user@alias.com), Google returns the PRIMARY Workspace domain in 'hd' (e.g. redadair.com.au).
            // This means we only need to configure the Primary Domain, and all aliases work automatically without listing them!

            const envAllowed = process.env.ALLOWED_WORKSPACE_DOMAINS || 'redadair.com.au';
            const allowedDomains = envAllowed.split(',').map(d => d.trim()).filter(Boolean);

            let isAllowed = false;
            let debugInfo = { hd: undefined as string | undefined, email: user.email };

            if (account?.provider === 'google') {
                const hostedDomain = (profile as any)?.hd;
                debugInfo.hd = hostedDomain;

                // Check if the user's Workspace (hd) is in our allowed list.
                // This covers: 
                // 1. Primary domain users (user@redadair.com.au -> hd: redadair.com.au)
                // 2. Alias domain users (user@secondary.com -> hd: redadair.com.au)
                if (hostedDomain && allowedDomains.includes(hostedDomain)) {
                    isAllowed = true;
                    console.log(`[Auth] User ${user.email} verified. Workspace (hd): ${hostedDomain} matches allowed list.`);
                } else if (hostedDomain) {
                    console.warn(`[Auth] REJECTED: User from unauthorized Workspace. HD: ${hostedDomain}, Expected: ${envAllowed}`);
                } else {
                    console.warn(`[Auth] REJECTED: User has no Workspace (hd) claim. Likely personal Gmail.`);
                }
            } else {
                // Fallback for non-google providers (if any)
                isAllowed = true;
            }

            if (!isAllowed) {
                console.error(`[Auth] Access denied for user: ${user.email}. Domain/Workspace validation failed.`);
                return '/unauthorized';
            }

            try {
                // ------------------------------------------------------------------
                // SMART ACCOUNT SYNCING (Google ID vs Email)
                // ------------------------------------------------------------------
                // We prioritize looking up by the stable Google Account ID (providerAccountId).
                // This handles cases where a user changes their email/name in Google Workspace 
                // but is still the same person. We simply update their info in our DB.

                let dbUser: any = null;

                // 1. Check if we already have this specific Google Account linked
                if (account) {
                    const existingAccount = await prisma.account.findUnique({
                        where: {
                            provider_providerAccountId: {
                                provider: account.provider,
                                providerAccountId: account.providerAccountId
                            }
                        },
                        include: { user: true }
                    });

                    if (existingAccount && existingAccount.user) {
                        // FOUND! This is the same person, even if email changed.
                        dbUser = existingAccount.user;
                        console.log(`[Auth] User identified by Google ID: ${dbUser.id}`);

                        // Check if details need updating (Sync Google -> DB)
                        if (dbUser.email !== user.email || dbUser.name !== user.name || dbUser.image !== user.image) {
                            console.log(`[Auth] User details changed in Google. Updating DB record...`);
                            // Note: We don't change the Role or Availability, just identity info.
                            dbUser = await prisma.user.update({
                                where: { id: dbUser.id },
                                data: {
                                    email: user.email,
                                    name: user.name,
                                    image: user.image,
                                    // optional: emailVerified: new Date()
                                }
                            });
                        }
                    }
                }

                // 2. If NOT found by Google ID, try finding by Email (Legacy/Invite flow)
                // This happens if:
                // a) It's a completely new user.
                // b) They existed before but somehow didn't have an Account row (rare).
                // c) THE USER WAS PRE-CREATED BY AN ADMIN (Invite Flow).
                if (!dbUser && user.email) {
                    dbUser = await prisma.user.findUnique({
                        where: { email: user.email }
                    });

                    if (dbUser) {
                        console.log(`[Auth] User identified by Email: ${dbUser.email}. Syncing with existing record...`);

                        // SYNC POINT: Update the existing DB user with Google's info
                        // We update name and image if they are missing or different.
                        dbUser = await prisma.user.update({
                            where: { id: dbUser.id },
                            data: {
                                name: user.name || dbUser.name,
                                image: user.image || dbUser.image,
                                emailVerified: new Date(),
                            }
                        });
                    }
                }

                // 3. If STILL not found, create a fresh User
                if (!dbUser) {
                    console.log(`[Auth] New User detected. Creating account for: ${user.email}`);
                    dbUser = await prisma.user.create({
                        data: {
                            email: user.email,
                            name: user.name,
                            image: user.image,
                            emailVerified: new Date(),
                            // Default Role/Dept will be assigned by schema defaults or later logic
                            availabilityStatus: 'AVAILABLE', // Default to AVAILABLE on creation
                        }
                    });
                }

                // 4. Force initial sync with Google Chat Presence on Login
                // Instead of blindly forcing 'AVAILABLE', we try to fetch the real status immediately
                if (dbUser && account?.access_token) {
                    let initialStatus = 'AVAILABLE';
                    try {
                        const chatRes = await fetch('https://chat.googleapis.com/v1/users/me/presence', {
                            headers: { 'Authorization': `Bearer ${account.access_token}` }
                        });

                        if (chatRes.ok) {
                            const chatData = await chatRes.json();
                            console.log('[Auth] Login Sync - Chat Presence:', chatData);

                            if (chatData.presence === 'DO_NOT_DISTURB') initialStatus = 'DO_NOT_DISTURB';
                            else if (chatData.presence === 'AWAY' || chatData.presence === 'OFFLINE') initialStatus = 'APPEAR_OFFLINE';
                            else initialStatus = 'AVAILABLE';
                        }
                    } catch (e) {
                        console.error('[Auth] Failed to sync status on login:', e);
                    }

                    await prisma.user.update({
                        where: { id: dbUser.id },
                        data: { availabilityStatus: initialStatus as any }
                    });
                }

                // 4. Ensure the OAuth Account Link exists and is up to date (Tokens)
                if (account && dbUser) {
                    const existingAccount = await prisma.account.findUnique({
                        where: {
                            provider_providerAccountId: {
                                provider: account.provider,
                                providerAccountId: account.providerAccountId
                            }
                        }
                    });

                    // Define account data
                    const accountData = {
                        userId: dbUser.id, // Ensure we link to the correct User ID
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
                    };

                    // Typescript fix for dynamic key in upsert
                    const userIdKey = 'userId';

                    if (existingAccount) {
                        // Update tokens
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
                    } else {
                        // Create Account Link
                        await prisma.account.create({
                            data: {
                                ...accountData,
                                userId: dbUser.id
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
        async jwt({ token, account, user, trigger, session }: any) {
            // Handle client-side session updates
            if (trigger === "update" && session) {
                console.log('[Auth] Session Update Triggered:', session);
                // We trust the update loop because it's initiated by our own app logic
                // after verifying with Google.
                // However, we mainly rely on the DB being updated.
                // But updating the token helps with immediate consistency.
                return { ...token, ...session.user };
            }

            // Initial sign in
            if (account && user) {
                // Find internal DB user by email to ensure we use our internal ID
                const dbUser = await prisma.user.findUnique({
                    where: { email: user.email as string }
                });

                return {
                    ...token,
                    accessToken: account.access_token,
                    refreshToken: account.refresh_token,
                    expiresAt: Date.now() + ((account.expires_in as number) * 1000), // expires_in is in seconds
                    id: dbUser?.id || user.id,
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
                        (session.user as any).availabilityStatus = dbUser.availabilityStatus;
                        (session.user as any).useCurrentTimezone = dbUser.useCurrentTimezone ?? true;
                        (session.user as any).selectedTimezone = dbUser.selectedTimezone || "UTC";
                        (session.user as any).location = dbUser.location;
                        (session.user as any).customStatusMessage = dbUser.customStatusMessage;
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
