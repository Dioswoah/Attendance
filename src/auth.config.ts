import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import type { NextAuthConfig } from "next-auth"

export default {
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    scope: 'openid email profile https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/chat.users.availability.readonly',
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        }),
        // Google One Tap — verifies the ID token credential directly (no OAuth redirect/account chooser)
        Credentials({
            id: "google-onetap",
            name: "Google One Tap",
            credentials: {
                credential: { label: "ID Token", type: "text" }
            },
            async authorize(credentials) {
                try {
                    const idToken = (credentials as any).credential
                    if (!idToken) return null

                    // Verify the ID token with Google
                    const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${idToken}`)
                    if (!res.ok) return null

                    const payload = await res.json()

                    // Validate: must be for our app
                    if (payload.aud !== process.env.AUTH_GOOGLE_ID) return null
                    if (payload.email_verified !== true && payload.email_verified !== 'true') return null

                    // Domain/Workspace check — only Google Workspace accounts (hd claim) are allowed.
                    // Personal Gmail accounts (no hd) are always rejected.
                    const allowedDomains = (process.env.ALLOWED_WORKSPACE_DOMAINS || 'redadair.com.au')
                        .split(',').map((d: string) => d.trim())
                    const hostedDomain = payload.hd  // only Google Workspace accounts have hd

                    if (!hostedDomain || !allowedDomains.includes(hostedDomain)) {
                        console.warn(`[Auth] One Tap REJECTED: email=${payload.email}, hd=${hostedDomain ?? 'none (personal Gmail)'}`)
                        return null
                    }

                    console.log(`[Auth] One Tap verified: ${payload.email}`)
                    return {
                        id: payload.sub,
                        email: payload.email,
                        name: payload.name,
                        image: payload.picture,
                    }
                } catch (e) {
                    console.error('[Auth] One Tap verification error:', e)
                    return null
                }
            }
        })
    ],
} satisfies NextAuthConfig

