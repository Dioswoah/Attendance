"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, MinusCircle, Clock, XCircle, ChevronDown, Circle } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"

export type UserStatus = 'AVAILABLE' | 'BUSY' | 'DO_NOT_DISTURB' | 'BE_RIGHT_BACK' | 'APPEAR_AWAY' | 'APPEAR_OFFLINE'

export const statusConfig: Record<UserStatus, { label: string, icon: any, color: string }> = {
    AVAILABLE: { label: 'Available', icon: CheckCircle2, color: 'text-green-500' },
    BUSY: { label: 'Busy', icon: Circle, color: 'text-red-500 fill-red-500' },
    DO_NOT_DISTURB: { label: 'Do not disturb', icon: MinusCircle, color: 'text-red-500' },
    BE_RIGHT_BACK: { label: 'Be right back', icon: Clock, color: 'text-yellow-500' },
    APPEAR_AWAY: { label: 'Appear away', icon: Clock, color: 'text-yellow-500' },
    APPEAR_OFFLINE: { label: 'Appear offline', icon: XCircle, color: 'text-slate-400' },
}

export function UserStatusDropdown({
    compact = false
}: {
    compact?: boolean
}) {
    const { data: session, update } = useSession()
    const [status, setStatus] = useState<UserStatus>('AVAILABLE')
    const [isLoading, setIsLoading] = useState(false)

    // Sync from session initially
    useEffect(() => {
        if (session?.user && (session.user as any).availabilityStatus) {
            setStatus((session.user as any).availabilityStatus)
        }
    }, [session])

    const handleStatusChange = async (newStatus: UserStatus) => {
        setStatus(newStatus) // Optimistic update
        setIsLoading(true)
        try {
            const res = await fetch('/api/user/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })

            if (res.ok) {
                // Ideally update session here
                await update({ availabilityStatus: newStatus })
            }
        } catch (error) {
            console.error("Failed to update status", error)
        } finally {
            setIsLoading(false)
        }
    }

    const CurrentIcon = statusConfig[status].icon

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className={cn(
                    "flex items-center gap-2 cursor-pointer transition-all hover:bg-slate-100/50 rounded-lg p-1",
                    compact ? "justify-center" : ""
                )}>
                    {compact ? (
                        <CurrentIcon className={cn("h-4 w-4", statusConfig[status].color)} />
                    ) : (
                        <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded-full border border-slate-100 shadow-sm">
                            <CurrentIcon className={cn("h-3.5 w-3.5", statusConfig[status].color)} />
                            <span className="text-xs font-semibold text-slate-700">{statusConfig[status].label}</span>
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                        </div>
                    )}
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Set Status
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(statusConfig) as UserStatus[]).map((key) => {
                    const config = statusConfig[key]
                    const Icon = config.icon
                    return (
                        <DropdownMenuItem
                            key={key}
                            onClick={() => handleStatusChange(key)}
                            className="gap-2 focus:bg-slate-100 cursor-pointer"
                        >
                            <Icon className={cn("h-4 w-4", config.color)} />
                            <span className={cn(
                                "text-sm",
                                status === key ? "font-bold" : "font-medium"
                            )}>
                                {config.label}
                            </span>
                            {status === key && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-slate-900" />
                            )}
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
