"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { TechniciansBoard } from "@/components/TechniciansBoard"

// Read-only field-status board for OPERATIONS staff (and admins/developers).
// Unlike other user-portal pages this one guards itself — the nav link is
// hidden for other roles, but direct navigation must also be blocked.
export default function UserTechniciansPage() {
    const router = useRouter()
    const { data: session, status } = useSession()
    const [isChecking, setIsChecking] = useState(true)

    useEffect(() => {
        if (status === "loading") return
        const roles = (session?.user as any)?.roles || []
        const allowed = roles.includes("OPERATIONS") || roles.includes("ADMIN") || roles.includes("DEVELOPER")
        if (!allowed) {
            router.push("/user")
        } else {
            setIsChecking(false)
        }
    }, [status, session, router])

    if (isChecking) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return <TechniciansBoard />
}
