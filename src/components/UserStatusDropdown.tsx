"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, MinusCircle, Clock, XCircle, ChevronDown, Circle } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export type UserStatus = 'AVAILABLE' | 'BUSY' | 'DO_NOT_DISTURB' | 'BE_RIGHT_BACK' | 'APPEAR_AWAY' | 'APPEAR_OFFLINE'

export const statusConfig: Record<UserStatus, { label: string, icon: any, color: string }> = {
    AVAILABLE: { label: 'Available', icon: CheckCircle2, color: 'text-emerald-500' },
    BUSY: { label: 'Busy', icon: Circle, color: 'text-red-500 fill-red-500' },
    DO_NOT_DISTURB: { label: 'Do not disturb', icon: MinusCircle, color: 'text-rose-500' },
    BE_RIGHT_BACK: { label: 'Be right back', icon: Clock, color: 'text-amber-500' },
    APPEAR_AWAY: { label: 'Appear away', icon: Clock, color: 'text-amber-500' },
    APPEAR_OFFLINE: { label: 'Appear offline', icon: XCircle, color: 'text-slate-400' },
}

export function UserStatusDropdown({
    compact = false,
    children
}: {
    compact?: boolean
    children?: React.ReactNode
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
                await update({ ...session, user: { ...session?.user, availabilityStatus: newStatus } })
            }
        } catch (error) {
            console.error("Failed to update status", error)
        } finally {
            setIsLoading(false)
        }
    }

    const getInitials = (name?: string | null) => {
        if (!name) return '??'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    }

    const CurrentIcon = statusConfig[status].icon
    const displayName = session?.user?.name || 'User'
    const userRoles = (session?.user as any)?.roles || []
    const userRole = userRoles.includes('ADMIN') ? 'Admin' : userRoles.includes('MANAGER') ? 'Manager' : 'Staff'

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {children ? children : (
                    <div className={cn(
                        "flex items-center gap-2 cursor-pointer transition-all hover:bg-white/10 rounded-lg p-1",
                        compact ? "justify-center" : ""
                    )}>
                        {compact ? (
                            <CurrentIcon className={cn("h-4 w-4", statusConfig[status].color)} />
                        ) : (
                            <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full border border-white/10 shadow-sm">
                                <CurrentIcon className={cn("h-3.5 w-3.5", statusConfig[status].color)} />
                                <span className="text-[10px] font-bold text-white uppercase tracking-widest">{statusConfig[status].label}</span>
                                <ChevronDown className="h-3 w-3 text-white/40" />
                            </div>
                        )}
                    </div>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 p-2 rounded-2xl bg-white border-slate-200 shadow-2xl text-slate-900">
                <div className="flex items-center gap-3 p-3 mb-1">
                    <Avatar className="w-10 h-10 border border-slate-100 shadow-sm">
                        {session?.user?.image ? (
                            <img src={session.user.image} alt="Profile" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <AvatarFallback className="bg-[#8B2323] text-white text-xs font-black">
                                {getInitials(displayName)}
                            </AvatarFallback>
                        )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate leading-tight text-slate-900">{displayName}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{userRole}</p>
                    </div>
                </div>

                <DropdownMenuSeparator className="bg-slate-100 mx-[-8px] my-2" />

                <DropdownMenuLabel className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 py-2">
                    Availability Status
                </DropdownMenuLabel>

                <div className="space-y-0.5">
                    {(Object.keys(statusConfig) as UserStatus[]).map((key) => {
                        const config = statusConfig[key]
                        const Icon = config.icon
                        const isActive = status === key

                        return (
                            <DropdownMenuItem
                                key={key}
                                onClick={() => handleStatusChange(key)}
                                className={cn(
                                    "gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 outline-none",
                                    isActive ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50/80 hover:text-slate-900"
                                )}
                            >
                                <div className={cn(
                                    "flex items-center justify-center w-5 h-5 rounded-full",
                                    isActive ? "bg-white shadow-sm border border-slate-100" : "bg-transparent"
                                )}>
                                    <Icon className={cn("h-3.5 w-3.5", config.color)} />
                                </div>
                                <span className={cn(
                                    "text-xs tracking-tight",
                                    isActive ? "font-bold" : "font-medium"
                                )}>
                                    {config.label}
                                </span>
                                {isActive && (
                                    <div className="ml-auto w-1 h-1 rounded-full bg-slate-900 animate-pulse" />
                                )}
                            </DropdownMenuItem>
                        )
                    })}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
