"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import {
    Search, Calendar, Clock, LogIn, LogOut, Coffee, FileText, Settings, ShieldCheck,
    AlertCircle, Eye, History, UserCheck, ShieldAlert, Edit2, Trash2, ListFilter,
    ChevronDown, ChevronRight, LayoutList
} from "lucide-react"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { getBrowserTimezone } from "@/lib/timezone"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const FILTER_OPTIONS = [
    { id: 'CLOCK_IN', label: 'Clock In' },
    { id: 'CLOCK_OUT', label: 'Clock Out' },
    { id: 'AUTO_CLOCK_OUT', label: 'Auto Clock Out' },
    { id: 'START_BREAK', label: 'Start Break' },
    { id: 'END_BREAK', label: 'End Break' },
    { id: 'LEAVES', label: 'Leaves & Absences' },
    { id: 'ADMIN', label: 'Admin & System Actions' }
]

export default function ActivityLogsPage() {
    const { data: session } = useSession()
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [selectedFilters, setSelectedFilters] = useState<string[]>([])
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
    const [userTimeZone, setUserTimeZone] = useState("Asia/Manila")

    useEffect(() => {
        if (session?.user) {
            const tz = (session.user as any).useCurrentTimezone
                ? getBrowserTimezone()
                : ((session.user as any).selectedTimezone || getBrowserTimezone());
            setUserTimeZone(tz);
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
            case 'START_BREAK': return { icon: Coffee, color: 'text-amber-600', label: 'Start Break', bg: 'bg-amber-100' }
            case 'END_BREAK': return { icon: Coffee, color: 'text-indigo-600', label: 'End Break', bg: 'bg-indigo-100' }
            case 'LEAVE_SUBMIT': return { icon: FileText, color: 'text-purple-600', label: 'Leave Request', bg: 'bg-purple-100' }
            case 'LEAVE_APPROVED': return { icon: ShieldCheck, color: 'text-green-700', label: 'Leave Approved', bg: 'bg-green-200' }
            case 'LEAVE_GRANTED_ADMIN': return { icon: ShieldCheck, color: 'text-green-700', label: 'Leave Approved', bg: 'bg-green-200' }
            case 'LEAVE_DECLINED': return { icon: AlertCircle, color: 'text-red-600', label: 'Leave Declined', bg: 'bg-red-100' }
            case 'LEAVE_EDIT': return { icon: Edit2, color: 'text-purple-600', label: 'Leave Edited', bg: 'bg-purple-100' }
            case 'LEAVE_CANCEL': return { icon: AlertCircle, color: 'text-slate-600', label: 'Leave Cancelled', bg: 'bg-slate-100' }
            case 'LEAVE_DELETE': return { icon: Trash2, color: 'text-red-600', label: 'Leave Deleted', bg: 'bg-red-100' }
            case 'ADMIN_EDIT': return { icon: Edit2, color: 'text-amber-600', label: 'Admin Edit', bg: 'bg-amber-100' }
            case 'ADMIN_DELETE': return { icon: Trash2, color: 'text-red-700', label: 'Admin Delete', bg: 'bg-red-100' }
            case 'ADMIN_LEAVE_EDIT': return { icon: Edit2, color: 'text-amber-600', label: 'Admin Leave Edit', bg: 'bg-amber-100' }
            case 'ATTENDANCE_REQUEST_SUBMIT': return { icon: History, color: 'text-indigo-600', label: 'Correction Request', bg: 'bg-indigo-100' }
            case 'ATTENDANCE_REQUEST_EDIT': return { icon: Edit2, color: 'text-indigo-600', label: 'Correction Edited', bg: 'bg-indigo-100' }
            case 'ATTENDANCE_REQUEST_DELETE': return { icon: Trash2, color: 'text-red-600', label: 'Correction Deleted', bg: 'bg-red-100' }
            case 'ATTENDANCE_REQUEST_APPROVED': return { icon: ShieldCheck, color: 'text-green-700', label: 'Correction Approved', bg: 'bg-green-200' }
            case 'ATTENDANCE_REQUEST_DECLINED': return { icon: AlertCircle, color: 'text-red-600', label: 'Correction Declined', bg: 'bg-red-100' }
            default: return { icon: Settings, color: 'text-slate-600', label: action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), bg: 'bg-slate-100' }
        }
    }

    const filteredLogs = useMemo(() => {
        return logs.filter((log: any) => {
            let matchesDate = true
            if (startDate && endDate) {
                const logDate = new Date(log.details?.time || log.createdAt)
                matchesDate = logDate >= startOfDay(new Date(startDate)) && logDate <= endOfDay(new Date(endDate))
            }
            if (!matchesDate) return false

            if (selectedFilters.length === 0) return true

            const action = log.action as string
            let mappedGroup = action
            if (action.startsWith('LEAVE_') || action.startsWith('ATTENDANCE_REQUEST_')) {
                mappedGroup = 'LEAVES'
            } else if (action.startsWith('ADMIN_') || action.startsWith('ATTENDANCE_SUMMARY')) {
                mappedGroup = 'ADMIN'
            }

            return selectedFilters.includes(action) || selectedFilters.includes(mappedGroup)
        })
    }, [logs, startDate, endDate, selectedFilters])

    const groupedLogs = useMemo(() => {
        return filteredLogs.reduce((acc: any, log: any) => {
            const dateStr = format(new Date(log.details?.time || log.createdAt), "yyyy-MM-dd")
            if (!acc[dateStr]) acc[dateStr] = []
            acc[dateStr].push(log)
            return acc
        }, {})
    }, [filteredLogs])

    const sortedDates = Object.keys(groupedLogs).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    // Toggle Handlers
    const toggleFilter = (id: string) => {
        setSelectedFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }
    const selectAllFilters = () => setSelectedFilters([]) // Clear = Match All
    const toggleDate = (dateStr: string) => {
        setExpandedDates(prev => {
            const next = new Set(prev)
            if (next.has(dateStr)) next.delete(dateStr)
            else next.add(dateStr)
            return next
        })
    }
    const expandAll = () => setExpandedDates(new Set(sortedDates))
    const collapseAll = () => setExpandedDates(new Set())

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

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-10 border-slate-200 shadow-sm rounded-xl font-bold bg-white text-slate-700 px-4 min-w-[150px] justify-between">
                                <div className="flex items-center gap-2">
                                    <ListFilter className="w-4 h-4 text-slate-400" />
                                    {selectedFilters.length === 0 ? "All Logs" : `${selectedFilters.length} Filters`}
                                </div>
                                <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3 rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border-slate-100" align="end">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <h4 className="text-xs font-black text-slate-400 tracking-widest uppercase">Filter Logs by</h4>
                                    <Button variant="ghost" size="sm" onClick={selectAllFilters} className="h-6 text-[10px] uppercase font-bold text-[#8B2323] hover:text-[#701c1c] hover:bg-red-50 px-2 rounded-md">
                                        Clear
                                    </Button>
                                </div>
                                <div className="grid gap-2">
                                    {FILTER_OPTIONS.map((option) => (
                                        <label key={option.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group">
                                            <Checkbox
                                                checked={selectedFilters.includes(option.id)}
                                                onCheckedChange={() => toggleFilter(option.id)}
                                                className="border-slate-300 group-hover:border-[#8B2323] data-[state=checked]:bg-[#8B2323] data-[state=checked]:border-[#8B2323]"
                                            />
                                            <span className="text-sm font-bold text-slate-700 select-none flex-1">
                                                {option.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="space-y-4">
                {/* Expander Controls if any records exist */}
                {!isLoading && sortedDates.length > 0 && (
                    <div className="flex items-center justify-end gap-3 mb-2 px-2">
                        <Button variant="ghost" size="sm" onClick={expandAll} className="h-8 text-xs font-black text-slate-500 hover:text-slate-900 hover:bg-slate-100 uppercase tracking-widest rounded-lg">
                            <LayoutList className="w-3.5 h-3.5 mr-1" /> Expand All
                        </Button>
                        <Button variant="ghost" size="sm" onClick={collapseAll} className="h-8 text-xs font-black text-slate-500 hover:text-slate-900 hover:bg-slate-100 uppercase tracking-widest rounded-lg">
                            Collapse All
                        </Button>
                    </div>
                )}

                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-4 pt-4">
                            <Skeleton className="h-6 w-48 rounded-full ml-2" />
                            <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden bg-white">
                                <CardContent className="p-0">
                                    <div className="p-4 space-y-6">
                                        {Array.from({ length: 2 }).map((_, j) => (
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
                ) : sortedDates.map((dateStr) => {
                    const dayLogs = groupedLogs[dateStr]
                    const isExpanded = expandedDates.has(dateStr)

                    return (
                        <div key={dateStr} className="space-y-2 pb-2">
                            {/* Target Row for Date Header - Clickable for collapsing */}
                            <button
                                onClick={() => toggleDate(dateStr)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100/70 transition-colors group cursor-pointer border border-transparent hover:border-slate-200"
                            >
                                <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center transition-colors", isExpanded ? "bg-[#8B2323] text-white" : "bg-slate-200 text-slate-500 group-hover:bg-slate-300")}>
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <h3 className={cn("text-sm font-black uppercase tracking-widest flex-1 text-left", isExpanded ? "text-slate-900" : "text-slate-600")}>
                                    {format(new Date(dateStr), "EEEE, MMM d, yyyy")}
                                    <span className="ml-3 px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold">
                                        {dayLogs.length} EVENTS
                                    </span>
                                </h3>
                                <div className="flex items-center justify-center p-1 rounded-full text-slate-400 bg-slate-100 group-hover:bg-white group-hover:text-slate-600">
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </div>
                            </button>

                            {/* Collapsed/Expanded Content */}
                            {isExpanded && (
                                <div className="pl-5 lg:pl-[44px] animate-in slide-in-from-top-2 fade-in duration-200">
                                    <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow flex flex-col">
                                        <CardContent className="p-0">
                                            <div className="divide-y divide-slate-50">
                                                {dayLogs.map((log: any) => {
                                                    const info = getActionInfo(log.action)
                                                    const Icon = info.icon
                                                    return (
                                                        <div key={log.id} className="group flex items-center gap-5 p-4 hover:bg-slate-50/50 transition-all duration-200">
                                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", info.bg)}>
                                                                <Icon className={cn("w-5 h-5", info.color)} />
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-3 mb-1">
                                                                    <span className="text-[13px] font-bold text-slate-800 uppercase tracking-tight">
                                                                        {info.label}
                                                                    </span>
                                                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter py-0 px-1.5 rounded-md border-slate-200 text-slate-400">
                                                                        {log.entityType}
                                                                    </Badge>
                                                                </div>

                                                                <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[11px] font-medium text-slate-500 italic">
                                                                    <span className="flex items-center gap-1">
                                                                        <UserCheck className="w-3 h-3 text-slate-400" />
                                                                        {log.details?.actor || 'System'}
                                                                    </span>
                                                                    {log.details?.status && (
                                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded-sm text-[9px] uppercase font-bold not-italic">
                                                                            {log.details.status}
                                                                        </span>
                                                                    )}
                                                                    {log.details?.reason && (
                                                                        <span className="text-slate-400 truncate max-w-[200px] lg:max-w-[400px]">
                                                                            &quot;{log.details.reason}&quot;
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="text-right flex flex-col items-end gap-0.5 text-slate-300 group-hover:text-slate-400">
                                                                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                                                                    <Clock className="w-3.5 h-3.5 text-slate-300" />
                                                                    {format(new Date(log.details?.time || log.createdAt), "h:mm a")}
                                                                </div>
                                                                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest pl-5">
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
                            )}
                        </div>
                    )
                })}

                {!isLoading && sortedDates.length === 0 && (
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
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
                    End of Ledger • End of Ledger • End of Ledger
                </p>
            </div>
        </div>
    )
}
