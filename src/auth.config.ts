import Google from "next-auth/providers/google"
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
                }
            }
        }),
    ],
} satisfies NextAuthConfig
