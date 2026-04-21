"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Clock, Calendar, AlertTriangle, AlertCircle, TrendingUp, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
// Ensure these functions are exported from relevant files like src/lib/performance-utils.ts
import {
    calculateUserPerformanceMetrics,
    // Types if needed
} from "@/lib/performance-utils"

interface StaffPerformanceCardProps {
    user: {
        id: string
        name: string
        email: string
        department?: any
        image?: string
        shiftStartTime?: string
        shiftEndTime?: string
        employmentLocation?: string
    }
    attendanceRecords: any[]
    dateRange: { start: string, end: string }
    onEditWorkHours?: (user: any) => void
    onClick?: (user: any) => void
}

export function StaffPerformanceCard({ user, attendanceRecords, dateRange, onEditWorkHours, onClick }: StaffPerformanceCardProps) {
    // Calculate individual metrics using our centralized utility
    const metrics = calculateUserPerformanceMetrics(attendanceRecords, user)

    return (
        <Card
            className={cn(
                "border border-border shadow-sm hover:shadow-md transition-all overflow-hidden bg-white",
                onClick && "cursor-pointer active:scale-[0.99]"
            )}
            onClick={() => onClick?.(user)}
        >
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0">
                            <AvatarFallback className="bg-slate-900 text-white font-bold text-xs">
                                {user.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <h3 className="font-bold text-sm text-foreground truncate">{user.name}</h3>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-widest truncate">
                                {(typeof user.department === 'object' ? (user.department as any)?.name : user.department) || 'Staff Member'}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                        <div
                            className="group flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 active:bg-slate-200 px-2 py-1.5 rounded-lg transition-all border border-transparent hover:border-slate-200 z-10 relative"
                            onClick={(e) => {
                                e.stopPropagation()
                                onEditWorkHours?.(user)
                            }}
                            role="button"
                            tabIndex={0}
                            title="Edit Work Hours"
                        >
                            <Badge variant="outline" className="font-mono text-[10px] bg-white border-slate-200 text-slate-600 mb-0 group-hover:border-slate-300 pointer-events-none whitespace-nowrap">
                                {user.shiftStartTime || "09:00"} - {user.shiftEndTime || "17:00"}
                            </Badge>
                            {onEditWorkHours && <Clock className="w-3 h-3 text-slate-400 group-hover:text-primary transition-colors shrink-0" />}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-3">
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Punctuality Rate */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Punctuality</span>
                        <div className="flex items-baseline gap-1">
                            <span className={cn("text-xl font-black", metrics.punctualityColor)}>
                                {metrics.punctualityRate}%
                            </span>
                        </div>
                    </div>

                    {/* Tardiness Average */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Avg Lateness</span>
                        <div className="flex items-baseline gap-1">
                            <span className={cn("text-xl font-black", metrics.tardinessColor)}>
                                {metrics.avgTardiness}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500">min</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                        <span className="text-slate-500 font-medium">On-Time Arrivals</span>
                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <span className="text-emerald-600">{metrics.onTimeDays}</span>
                            <span className="text-slate-300">/</span>
                            <span>{metrics.totalDays}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                        <span className="text-slate-500 font-medium">{user.employmentLocation === 'Philippines' || 1 ? 'Total Late Time' : 'Late Arrivals'}</span>
                        <span className={cn("font-bold", metrics.totalLateMinutes && metrics.totalLateMinutes > 0 ? "text-amber-600" : "text-slate-400")}>
                            {metrics.totalLateMinutes && metrics.totalLateMinutes > 0 ? `${metrics.totalLateMinutes} min` : "None"}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
