"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function SessionGuard({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession()
    const router = useRouter()

    useEffect(() => {
        if ((session as any)?.error === "ArchivedUserError") {
            // Force logout and redirect
            signOut({ callbackUrl: "/unauthorized?reason=archived" })
        }
    }, [session])

    return <>{children}</>
}
