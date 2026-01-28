import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            department?: string
            roles?: string[]
            managerId?: string | null
        } & DefaultSession["user"]
        accessToken?: string
        error?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string
        accessToken?: string
        refreshToken?: string
        expiresAt?: number
        error?: string
    }
}
