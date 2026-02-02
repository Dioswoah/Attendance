"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Calendar, Clock, LogIn, LogOut, Coffee, FileText, Loader2 } from "lucide-react"
import { format } from "date-fns"

interface ActivityLog {
    id: string
    date: string
    type: "clock-in" | "clock-out" | "break-start" | "break-end" | "leave-request" | "leave-approved" | "leave-denied"
    time: string
    details: string
    employeeName?: string
}

export default function ActivityLogsPage() {
    const { data: session, status } = useSession()
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [filterType, setFilterType] = useState<string>("all")
    const [startDate, setStartDate] = useState<string>(format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (session?.user?.id) {
            fetchActivityLogs()
        }
    }, [session, startDate, endDate])

    const fetchActivityLogs = async () => {
        if (!session?.user?.id) return
        setIsLoading(true)
        try {
            let url = `/api/attendance?userId=${session.user.id}`

            if (startDate && endDate) {
                url += `&startDate=${startDate}&endDate=${endDate}`
            }

            const res = await fetch(url)
            if (res.ok) {
                const attendanceData = await res.json()
                const activityLogs = convertAttendanceToLogs(attendanceData)
                setLogs(activityLogs)
            }
        } catch (error) {
            // Error
        } finally {
            setIsLoading(false)
        }
    }

    const convertAttendanceToLogs = (attendanceData: any[]): ActivityLog[] => {
        const logs: ActivityLog[] = []

        attendanceData.forEach((record) => {
            if (record.clockIn) {
                logs.push({
                    id: `${record.id}-in`,
                    date: new Date(record.clockIn).toISOString().split('T')[0],
                    type: "clock-in",
                    time: new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' }),
                    details: `Clocked in from ${record.mode.toLowerCase()}`
                })
            }

            if (record.breakStart) {
                logs.push({
                    id: `${record.id}-break-start`,
                    date: new Date(record.breakStart).toISOString().split('T')[0],
                    type: "break-start",
                    time: new Date(record.breakStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' }),
                    details: "Started break"
                })
            }

            if (record.breakEnd) {
                logs.push({
                    id: `${record.id}-break-end`,
                    date: new Date(record.breakEnd).toISOString().split('T')[0],
                    type: "break-end",
                    time: new Date(record.breakEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' }),
                    details: "Ended break"
                })
            }

            if (record.clockOut) {
                logs.push({
                    id: `${record.id}-out`,
                    date: new Date(record.clockOut).toISOString().split('T')[0],
                    type: "clock-out",
                    time: new Date(record.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' }),
                    details: "Clocked out"
                })
            }
        })

        return logs.sort((a, b) => new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime())
    }

    const getTypeIcon = (type: ActivityLog["type"]) => {
        switch (type) {
            case "clock-in":
                return <LogIn className="w-5 h-5" />
            case "clock-out":
                return <LogOut className="w-5 h-5" />
            case "break-start":
            case "break-end":
                return <Coffee className="w-5 h-5" />
            default:
                return <FileText className="w-5 h-5" />
        }
    }

    const getTypeBadge = (type: ActivityLog["type"]) => {
        switch (type) {
            case "clock-in":
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200 font-medium text-xs">Clock In</Badge>
            case "clock-out":
                return <Badge variant="secondary" className="font-medium text-xs">Clock Out</Badge>
            case "break-start":
                return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100/80 border-orange-200 font-medium text-xs">Break Start</Badge>
            case "break-end":
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100/80 border-blue-200 font-medium text-xs">Break End</Badge>
            case "leave-request":
                return <Badge variant="outline" className="font-medium text-xs border-border text-muted-foreground">Leave Request</Badge>
            case "leave-approved":
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200 font-medium text-xs">Approved</Badge>
            case "leave-denied":
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200 font-medium text-xs">Denied</Badge>
        }
    }

    const filteredLogs = logs.filter((log) => {
        const matchesSearch = log.details.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesType =
            filterType === "all" ||
            (filterType === "attendance" && ["clock-in", "clock-out", "break-start", "break-end"].includes(log.type)) ||
            (filterType === "leave" && ["leave-request", "leave-approved", "leave-denied"].includes(log.type))
        return matchesSearch && matchesType
    })

    // Group logs by date
    const groupedLogs = filteredLogs.reduce(
        (acc, log) => {
            if (!acc[log.date]) {
                acc[log.date] = []
            }
            acc[log.date].push(log)
            return acc
        },
        {} as Record<string, ActivityLog[]>
    )

    if (status === "loading" || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
        )
    }

    return (
        <div className="space-y-8 w-full">
            {/* Header */}
            <div id="tour-activity-header">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Activity Logs</h1>
                <p className="text-base text-muted-foreground mt-1">View your attendance and leave request history</p>
            </div>

            {/* Filters */}
            <div id="tour-activity-filters" className="flex flex-col xl:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10 bg-white border-border rounded-lg text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-40 h-10 bg-white border-border rounded-lg">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Activities</SelectItem>
                            <SelectItem value="attendance">Attendance</SelectItem>
                            <SelectItem value="leave">Leave</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Date Range Inputs */}
                    <div className="flex items-center gap-2 bg-white p-1 border border-border rounded-lg shadow-sm">
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</span>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-8 w-32 border-none bg-transparent focus-visible:ring-0 text-xs font-medium"
                            />
                        </div>
                        <div className="w-px h-6 bg-border mx-1" />
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To</span>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="h-8 w-32 border-none bg-transparent focus-visible:ring-0 text-xs font-medium"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Logs Timeline */}
            <div id="tour-activity-list" className="space-y-8">
                {Object.entries(groupedLogs).map(([date, logs]) => (
                    <div key={date} className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-semibold text-foreground">
                                {format(new Date(date), "EEEE, MMMM d, yyyy")}
                            </h3>
                        </div>
                        <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                            <CardContent className="p-0">
                                <div className="max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                                    <div className="divide-y divide-border/50">
                                        {logs.map((log) => (
                                            <div key={log.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                                                <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                                                    {getTypeIcon(log.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 flex-wrap mb-1">
                                                        <span className="text-sm font-medium text-foreground">{log.details}</span>
                                                        {getTypeBadge(log.type)}
                                                    </div>
                                                    {log.employeeName && (
                                                        <p className="text-xs text-muted-foreground">{log.employeeName}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {log.time}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ))}

                {Object.keys(groupedLogs).length === 0 && (
                    <Card className="border border-border shadow-sm rounded-xl bg-white">
                        <CardContent className="p-12 text-center">
                            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-foreground">No logs found</h3>
                            <p className="text-sm text-muted-foreground mt-1">No activity logs match your current filters.</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                    Showing {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
                </p>
            </div>
        </div>
    )
}
