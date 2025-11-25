"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Clock, AlertCircle, CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"

interface AttendanceRecord {
    id: string
    userId: string
    date: string
    clockIn: string
    clockOut: string | null
    status: string
    mode: string
    user: {
        id: string
        name: string
        email: string
        department: {
            name: string
        } | null
    }
}

export default function AdminDashboard() {
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [totalStaff, setTotalStaff] = useState(0)
    const [employees, setEmployees] = useState<any[]>([])
    const [departments, setDepartments] = useState<any[]>([])

    const fetchData = async () => {
        try {
            const today = new Date().toISOString().split('T')[0]
            const [attendanceRes, employeesRes, departmentsRes] = await Promise.all([
                fetch(`/api/attendance?date=${today}`),
                fetch('/api/employees'),
                fetch('/api/departments')
            ])
            const attendanceData = await attendanceRes.json()
            const employeesData = await employeesRes.json()
            const departmentsData = await departmentsRes.json()
            setRecords(attendanceData)
            setEmployees(employeesData)
            setDepartments(departmentsData)
            setTotalStaff(employeesData.length)
        } catch (error) {
            console.error('Error fetching attendance:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()

        // Auto-refresh every 30 seconds for real-time updates
        const refreshInterval = setInterval(fetchData, 30000)

        // Check for date change every minute (to reset at midnight)
        let currentDate = new Date().toISOString().split('T')[0]
        const dateCheckInterval = setInterval(() => {
            const newDate = new Date().toISOString().split('T')[0]
            if (newDate !== currentDate) {
                currentDate = newDate
                // Date changed (midnight passed), refresh data
                fetchData()
            }
        }, 60000) // Check every minute

        return () => {
            clearInterval(refreshInterval)
            clearInterval(dateCheckInterval)
        }
    }, [])

    // Get unique user IDs who have any attendance record today
    const uniqueUserIdsWithRecords = new Set(records.map(r => r.userId))

    // Clocked in = has a record today with no clock out time
    const clockedIn = records.filter(r => r.clockOut === null).length

    // Absent = total staff minus people who have clocked in today (regardless of whether they clocked out)
    const absent = totalStaff - uniqueUserIdsWithRecords.size

    const onBreak = 0 // We'll implement break tracking later

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">Overview of today's attendance and workforce status.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalStaff}</div>
                        <p className="text-xs text-muted-foreground">Active employees</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Clocked In</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{clockedIn}</div>
                        <p className="text-xs text-muted-foreground">{totalStaff > 0 ? Math.round((clockedIn / totalStaff) * 100) : 0}% of workforce</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">On Break</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{onBreak}</div>
                        <p className="text-xs text-muted-foreground">Currently on break</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Absent</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{absent}</div>
                        <p className="text-xs text-muted-foreground">Not clocked in yet</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Latest clock-ins and clock-outs.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {loading ? (
                                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
                            ) : records.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No attendance records yet today</p>
                            ) : (
                                records.slice(0, 5).map((record) => (
                                    <div key={record.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-4">
                                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center font-semibold">
                                                {record.user.name?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium leading-none">{record.user.name || 'Unknown'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {record.clockOut ? 'Clocked Out' : 'Clocked In'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium">
                                                {new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <p className="text-xs text-green-500">
                                                {record.mode.toUpperCase()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Department Status</CardTitle>
                        <CardDescription>Attendance by department.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {departments.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No departments found</p>
                            ) : (
                                departments.map((dept) => {
                                    // Count total employees in this department
                                    const totalInDept = employees.filter(emp => emp.departmentId === dept.id).length

                                    // Count unique users who clocked in today from this department
                                    const presentUsers = new Set(
                                        records
                                            .filter(r => r.user.department?.name === dept.name)
                                            .map(r => r.userId)
                                    )
                                    const present = presentUsers.size

                                    return (
                                        <div key={dept.id} className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium leading-none">{dept.name}</p>
                                                <p className="text-xs text-muted-foreground">{present}/{totalInDept} Present</p>
                                            </div>
                                            <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className="h-full bg-primary"
                                                    style={{ width: `${totalInDept > 0 ? (present / totalInDept) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
