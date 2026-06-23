"use client"

import { useState, useEffect } from "react"
import { useSSE } from "@/contexts/SSEContext"
import { Bell, Check, Info, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useSession } from "next-auth/react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { io } from "socket.io-client"

interface Notification {
    id: string
    title: string
    message: string
    type: string
    read: boolean
    createdAt: string
    link?: string
}

interface NotificationBellProps {
    role?: string // "ADMIN" or undefined (for User/Manager using session)
    userId?: string // Explicit userId
}

export function NotificationBell({ role, userId: propUserId }: NotificationBellProps) {
    const { data: session } = useSession()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    // Determine effective User ID or Role to fetch
    const fetchNotifications = async () => {
        const targetUserId = propUserId || session?.user?.id

        let url = '/api/notifications'
        if (targetUserId) {
            url += `?userId=${targetUserId}`
        } else if (role) {
            url += `?role=${role}`
        } else {
            return // No context to fetch
        }

        try {
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setNotifications(data)
                setUnreadCount(data.filter((n: Notification) => !n.read).length)
            }
        } catch (error) {
            // Error handled
        }
    }

    useEffect(() => {
        fetchNotifications()
    }, [session, role, propUserId])

    useSSE((payload) => {
        if (payload.type === 'notification' || payload.type === 'attendance' || payload.type === 'leaves') {
            fetchNotifications()
        }
    })

    const markAsRead = async (id?: string) => {
        try {
            const userId = propUserId || session?.user?.id
            if (!userId && !id) return; // Need at least a user ID or a specific notification ID

            let url = '/api/notifications'
            if (id) {
                url += `?id=${id}`
            } else {
                url += `?userId=${userId}` // Mark all for user
            }

            await fetch(url, { method: 'PUT' })
            await fetchNotifications()
        } catch (error) {
            console.error("Failed to mark notifications as read:", error)
        }
    }

    return (
        <Popover open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (open) fetchNotifications();
        }}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-600 border-2 border-white animate-pulse" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="end">
                <div className="bg-white flex flex-col max-h-[400px]">
                    <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-white sticky top-0 z-10">
                        <span className="font-black text-[10px] uppercase tracking-widest text-slate-900 italic">Notifications</span>
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead()}
                                className="h-6 text-[9px] font-bold text-red-600 hover:bg-red-50 hover:text-red-700 uppercase tracking-wider px-2 rounded-lg"
                            >
                                Mark all read
                            </Button>
                        )}
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-300 flex flex-col items-center gap-2">
                                <Bell className="h-8 w-8 opacity-20" />
                                <span className="text-[9px] font-black uppercase tracking-widest italic">No new signals</span>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={cn(
                                        "p-3 rounded-xl transition-all border border-transparent hover:border-slate-100 group relative",
                                        n.read ? "bg-white opacity-60 hover:opacity-100" : "bg-red-50/30"
                                    )}
                                    onClick={() => !n.read && markAsRead(n.id)}
                                >
                                    <div className="flex gap-3">
                                        <div className={cn(
                                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                            n.type === 'LEAVE_REQUEST' ? "bg-blue-100 text-blue-600" :
                                                n.type === 'LEAVE_STATUS' && n.message.includes('declined') ? "bg-red-100 text-red-600" :
                                                    "bg-green-100 text-green-600"
                                        )}>
                                            {n.type === 'LEAVE_REQUEST' ? <Info className="h-4 w-4" /> :
                                                n.message.includes('declined') ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black uppercase tracking-wide text-slate-800 italic leading-tight">{n.title}</span>
                                            <p className="text-[10px] font-medium text-slate-500 leading-snug">{n.message}</p>
                                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1">
                                                {new Date(n.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    {!n.read && (
                                        <div className="absolute top-3 right-3 h-1.5 w-1.5 rounded-full bg-red-600" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
