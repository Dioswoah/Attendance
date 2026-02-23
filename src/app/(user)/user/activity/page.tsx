"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Calendar, Clock, LogIn, LogOut, Coffee, FileText, Settings, ShieldCheck, AlertCircle, Eye, History, UserCheck, ShieldAlert, Edit2, Trash2 } from "lucide-react"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { getBrowserTimezone } from "@/lib/timezone"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export default function ActivityLogsPage() {
    const { data: session } = useSession()
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [filterType, setFilterType] = useState<string>("all")
    const [userTimeZone, setUserTimeZone] = useState("Asia/Manila")

    useEffect(() => {
        if (session?.user) {
            setUserTimeZone((session.user as any).selectedTimezone || getBrowserTimezone())
        }
    }, [session])

    const fetcher = (url: string) => fetch(url).then(res => res.json())
    const { data, isLoading } = useSWR(
        session?.user?.id ? `/api/activity-logs?limit=500&userId=${session.user.id}` : null,
        fetcher
    )

    const logs = data?.logs || []

    const getActionInfo = (action: string) => {
        switch (action) {
            case 'CLOCK_IN': return { icon: LogIn, color: 'text-green-600', label: 'Clock In', bg: 'bg-green-100' }
            case 'CLOCK_OUT': return { icon: LogOut, color: 'text-blue-600', label: 'Clock Out', bg: 'bg-blue-100' }
            case 'AUTO_CLOCK_OUT': return { icon: ShieldAlert, color: 'text-orange-600', label: 'Auto Clock Out', bg: 'bg-orange-100' }
            case 'LEAVE_SUBMIT': return { icon: FileText, color: 'text-purple-600', label: 'Leave Request', bg: 'bg-purple-100' }
            case 'LEAVE_APPROVED': return { icon: ShieldCheck, color: 'text-green-700', label: 'Leave Approved', bg: 'bg-green-200' }
            case 'LEAVE_DECLINED': return { icon: AlertCircle, color: 'text-red-600', label: 'Leave Declined', bg: 'bg-red-100' }
            case 'ADMIN_EDIT': return { icon: Edit2, color: 'text-amber-600', label: 'Admin Edit', bg: 'bg-amber-100' }
            case 'ADMIN_DELETE': return { icon: Trash2, color: 'text-red-700', label: 'Admin Delete', bg: 'bg-red-100' }
            case 'ATTENDANCE_REQUEST_SUBMIT': return { icon: History, color: 'text-indigo-600', label: 'Correction Request', bg: 'bg-indigo-100' }
            case 'ATTENDANCE_SUMMARY_UPPERCASE': return { icon: UserCheck, color: 'text-teal-600', label: 'Summary Update', bg: 'bg-teal-100' }
            default: return { icon: Settings, color: 'text-slate-600', label: action, bg: 'bg-slate-100' }
        }
    }

    const filteredLogs = logs.filter((log: any) => {
        let matchesDate = true
        if (startDate && endDate) {
            const logDate = new Date(log.createdAt)
            matchesDate = logDate >= startOfDay(new Date(startDate)) && logDate <= endOfDay(new Date(endDate))
        }

        if (!matchesDate) return false

        if (filterType === 'all') return true
        if (filterType === 'attendance') return ['CLOCK_IN', 'CLOCK_OUT', 'AUTO_CLOCK_OUT'].includes(log.action)
        if (filterType === 'leave') return log.action.startsWith('LEAVE_')
        if (filterType === 'admin') return log.action.startsWith('ADMIN_')
        return true
    })

    const groupedLogs = filteredLogs.reduce((acc: any, log: any) => {
        const dateStr = format(new Date(log.createdAt), "yyyy-MM-dd")
        if (!acc[dateStr]) acc[dateStr] = []
        acc[dateStr].push(log)
        return acc
    }, {})

    return (
        <div className="space-y-8 w-full p-4 lg:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-[#8B2323] uppercase">Activity Logs</h1>
                    <p className="text-red-900/60 mt-1 font-bold text-sm tracking-widest uppercase">Your Recent Activities</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-red-100 p-1 rounded-xl shadow-sm">
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-36 border-none shadow-none focus-visible:ring-0 text-sm font-bold text-slate-700"
                        />
                        <span className="text-red-300 font-bold">&rarr;</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-36 border-none shadow-none focus-visible:ring-0 text-sm font-bold text-slate-700"
                        />
                    </div>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-40 border-slate-200 shadow-sm rounded-xl">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Logs</SelectItem>
                            <SelectItem value="attendance">Attendance</SelectItem>
                            <SelectItem value="leave">Leaves</SelectItem>
                            <SelectItem value="admin">System/Admin</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-10">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-4">
                            <Skeleton className="h-6 w-48 rounded-full" />
                            <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden bg-white">
                                <CardContent className="p-0">
                                    <div className="p-4 space-y-6">
                                        {Array.from({ length: 4 }).map((_, j) => (
                                            <div key={j} className="flex items-center gap-4">
                                                <Skeleton className="h-12 w-12 rounded-2xl flex-shrink-0" />
                                                <div className="space-y-2 flex-1">
                                                    <Skeleton className="h-4 w-1/4" />
                                                    <Skeleton className="h-3 w-1/2" />
                                                </div>
                                                <Skeleton className="h-4 w-16" />
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ))
                ) : Object.entries(groupedLogs).map(([date, dayLogs]: [string, any]) => (
                    <div key={date} className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="h-8 w-8 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                                <Calendar className="w-4 h-4" />
                            </div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                                {format(new Date(date), "EEEE, MMM d, yyyy")}
                            </h3>
                            <div className="h-px bg-slate-100 flex-1 ml-4" />
                        </div>

                        <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow duration-300">
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-50">
                                    {dayLogs.map((log: any) => {
                                        const info = getActionInfo(log.action)
                                        const Icon = info.icon
                                        return (
                                            <div key={log.id} className="group flex items-center gap-5 p-5 hover:bg-slate-50/50 transition-all duration-200">
                                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", info.bg)}>
                                                    <Icon className={cn("w-6 h-6", info.color)} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                                                            {info.label}
                                                        </span>
                                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter py-0 px-2 rounded-md border-slate-200 text-slate-400">
                                                            {log.entityType}
                                                        </Badge>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs font-medium text-slate-500 italic">
                                                        <span className="flex items-center gap-1.5">
                                                            <UserCheck className="w-3.5 h-3.5" />
                                                            {log.details?.actor || 'System'}
                                                        </span>
                                                        {log.details?.status && (
                                                            <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold not-italic">
                                                                {log.details.status}
                                                            </span>
                                                        )}
                                                        {log.details?.reason && (
                                                            <span className="text-slate-400 truncate max-w-[300px]">
                                                                &quot;{log.details.reason}&quot;
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-right flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                                                        <Clock className="w-4 h-4 text-slate-300" />
                                                        {format(new Date(log.createdAt), "h:mm a")}
                                                    </div>
                                                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                                        {userTimeZone.split('/').pop()}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ))}

                {!isLoading && data?.logs?.length === 0 && (
                    <Card className="rounded-3xl border-dashed border-2 border-slate-200 shadow-none bg-slate-50/30">
                        <CardContent className="p-20 text-center">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <Eye className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Nothing here yet</h3>
                            <p className="text-slate-500 mt-2 font-medium">Activity logs will appear as you and the system interact.</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="flex items-center justify-center pt-8 border-t border-slate-100">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">
                    End of Ledger • End of Ledger • End of Ledger
                </p>
            </div>
        </div>
    )
}
