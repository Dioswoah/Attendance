"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function KPIRedirect() {
    const router = useRouter()
    useEffect(() => { router.replace("/admin/ai-insights") }, [router])
    return null
}
