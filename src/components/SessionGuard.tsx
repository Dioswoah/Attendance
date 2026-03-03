"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

export function SessionGuard({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        if (pathname === "/unauthorized") return;

        const error = (session as any)?.error;
        if (error === "ArchivedUserError") {
            signOut({ callbackUrl: "/unauthorized?reason=archived" })
        } else if (error === "ForceSignOutError") {
            signOut({ callbackUrl: "/unauthorized?reason=forced" })
        } else if (error === "RefreshAccessTokenError") {
            // Re-auth if token refresh failed
            signOut({ callbackUrl: "/unauthorized?reason=refresh_failed" })
        }
    }, [session])

    return <>{children}</>
}
