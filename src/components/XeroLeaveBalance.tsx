"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

interface LeaveBalance {
    name: string
    units: number
    typeOfUnits: string
}

interface XeroLeaveBalanceProps {
    email?: string | null
    className?: string
}

export function XeroLeaveBalance({ email, className }: XeroLeaveBalanceProps) {
    const [data, setData] = useState<{ connected: boolean; found?: boolean; leaveBalances?: LeaveBalance[] } | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!email) { setData(null); return }
        setLoading(true)
        fetch(`/api/xero/leave-balance?email=${encodeURIComponent(email)}`)
            .then(r => r.json())
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false))
    }, [email])

    if (!email || !data || !data.connected) return null
    if (loading) return (
        <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ''}`}>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Loading Xero balances...</span>
        </div>
    )
    if (!data.found) return (
        <div className={`text-xs text-muted-foreground ${className ?? ''}`}>
            <span className="inline-flex items-center gap-1">
                <span className="font-medium text-[#13B5EA]">Xero</span>
                <span>— Employee not linked</span>
            </span>
        </div>
    )
    if (!data.leaveBalances?.length) return (
        <div className={`text-xs text-muted-foreground ${className ?? ''}`}>
            <span className="font-medium text-[#13B5EA]">Xero</span>
            <span className="ml-1">— No leave balances configured</span>
        </div>
    )

    return (
        <div className={`space-y-1 ${className ?? ''}`}>
            <p className="text-xs font-medium text-[#13B5EA]">Xero Leave Balances</p>
            <div className="flex flex-wrap gap-1.5">
                {data.leaveBalances.map((lb) => {
                    const hours = lb.units
                    const days = (hours / 8).toFixed(1)
                    return (
                        <span
                            key={lb.name}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#13B5EA]/10 text-[#0d8cb5] border border-[#13B5EA]/20 font-medium"
                        >
                            {lb.name}
                            <span className="font-normal text-muted-foreground">
                                {hours % 1 === 0 ? hours : hours.toFixed(1)}h ({days}d)
                            </span>
                        </span>
                    )
                })}
            </div>
        </div>
    )
}
