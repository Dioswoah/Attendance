"use client"

import { useState, useEffect } from "react"
import { Bell, ShieldCheck, Mail } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { Switch } from "@/components/ui/switch"

export function ManagerNotificationSettings() {
    const { data: session } = useSession()
    const [enabled, setEnabled] = useState(true)
    const [loading, setLoading] = useState(true)

    const userRoles = (session?.user as any)?.roles || []
    const isManagerOrAdmin = userRoles.includes('MANAGER') || userRoles.includes('ADMIN')

    useEffect(() => {
        const fetchSettings = async () => {
            if (!session?.user) return
            try {
                const res = await fetch('/api/user/me')
                if (res.ok) {
                    const data = await res.json()
                    // Initialize with current value from DB
                    setEnabled(data.managerNotificationsEnabled ?? true)
                }
            } catch (error) {
                console.error("Failed to fetch notification settings", error)
            } finally {
                setLoading(false)
            }
        }
        fetchSettings()
    }, [session])

    const handleToggle = async (checked: boolean) => {
        const previousState = enabled
        setEnabled(checked)

        try {
            const res = await fetch('/api/user/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    managerNotificationsEnabled: checked
                })
            })

            if (res.ok) {
                toast.success(checked ? "Email notifications enabled" : "Email notifications disabled")
            } else {
                setEnabled(previousState)
                toast.error("Failed to update notification settings")
            }
        } catch (error) {
            setEnabled(previousState)
            toast.error("Failed to update notification settings")
        }
    }

    if (!isManagerOrAdmin) {
        return null
    }

    return (
        <div className="flex items-center w-full px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-all group mb-1">
            <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shrink-0 group-hover:bg-orange-100 transition-colors">
                <Mail className="w-4 h-4" />
            </div>
            <div className="flex-1 ml-3 overflow-hidden">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Subordinate Alerts</span>
                    <Switch
                        checked={enabled}
                        onCheckedChange={handleToggle}
                        disabled={loading}
                        className="data-[state=checked]:bg-orange-600 scale-75 origin-right"
                    />
                </div>
                <p className="text-[10px] text-slate-400 font-medium truncate">Email alerts for late/absent staff</p>
            </div>
        </div>
    )
}
