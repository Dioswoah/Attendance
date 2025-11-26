"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw } from "lucide-react"

interface AttendanceRecord {
    id: string
    date: string
    clockIn: string
    clockOut: string | null
    status: string
    mode: string
    user: {
        name: string
        department: {
            name: string
        } | null
    }
}

interface Department {
    id: string
    name: string
}

export default function HistoryPage() {
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [selectedDepartment, setSelectedDepartment] = useState("all")

    useEffect(() => {
        fetchDepartments()
    }, [])

    useEffect(() => {
        fetchRecords()
    }, [startDate, endDate])

    const fetchDepartments = async () => {
        try {
            const res = await fetch('/api/departments')
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data)) {
                    setDepartments(data)
                } else {
                    console.error('Departments API returned non-array data:', data)
                    setDepartments([])
                }
            } else {
                console.error('Failed to fetch departments:', res.status)
                setDepartments([])
            }
        } catch (error) {
            console.error('Error fetching departments:', error)
            setDepartments([])
        }
    }

    const fetchRecords = async () => {
        setLoading(true)
        try {
            // Fetch records for each day in the range
            const start = new Date(startDate)
            const end = new Date(endDate)
            const allRecords: AttendanceRecord[] = []

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0]
                const res = await fetch(`/api/attendance?date=${dateStr}`)
                if (res.ok) {
                    const data = await res.json()
                    if (Array.isArray(data)) {
                        allRecords.push(...data)
                    } else {
                        console.error('Attendance API returned non-array data for date', dateStr, ':', data)
                    }
                } else {
                    console.error('Failed to fetch attendance for date', dateStr, ':', res.status)
                }
            }

            setRecords(allRecords)
        } catch (error) {
            console.error('Error fetching records:', error)
            setRecords([])
        } finally {
            setLoading(false)
        }
    }

    const setQuickRange = (days: number) => {
        const end = new Date()
        const start = new Date()
        start.setDate(start.getDate() - days + 1)
        setStartDate(start.toISOString().split('T')[0])
        setEndDate(end.toISOString().split('T')[0])
    }

    const setToday = () => {
        const today = new Date().toISOString().split('T')[0]
        setStartDate(today)
        setEndDate(today)
    }

    const setThisMonth = () => {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        setStartDate(start.toISOString().split('T')[0])
        setEndDate(now.toISOString().split('T')[0])
    }

    const filteredRecords = selectedDepartment === "all"
        ? records
        : records.filter(r => r.user.department?.name === selectedDepartment)

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }

    const calculateHours = (clockIn: string, clockOut: string | null) => {
        if (!clockOut) return "In Progress"
        const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        return `${hours}h ${minutes}m`
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Attendance History Dashboard</h1>
                <p className="text-muted-foreground">View and analyze historical attendance records.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Start Date</label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">End Date</label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Department</label>
                                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Departments</SelectItem>
                                        {departments.map((dept) => (
                                            <SelectItem key={dept.id} value={dept.name}>
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Quick Date Ranges</label>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={setToday}>
                                    Today
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setQuickRange(7)}>
                                    Last 7 days
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setQuickRange(30)}>
                                    Last 30 days
                                </Button>
                                <Button variant="outline" size="sm" onClick={setThisMonth}>
                                    This Month
                                </Button>
                                <Button onClick={fetchRecords} size="sm">
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Attendance Records</CardTitle>
                    <CardDescription>
                        Showing {filteredRecords.length} record(s) from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-center py-8 text-muted-foreground">Loading...</p>
                    ) : filteredRecords.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">No records found</p>
                    ) : (
                        <div className="rounded-md border">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="p-3 text-left font-medium">Staff Member</th>
                                        <th className="p-3 text-left font-medium">Department</th>
                                        <th className="p-3 text-left font-medium">Clock In</th>
                                        <th className="p-3 text-left font-medium">Clock Out</th>
                                        <th className="p-3 text-left font-medium">Hours</th>
                                        <th className="p-3 text-left font-medium">Mode</th>
                                        <th className="p-3 text-left font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.map((record) => (
                                        <tr key={record.id} className="border-b last:border-0">
                                            <td className="p-3 font-medium">{record.user.name}</td>
                                            <td className="p-3">{record.user.department?.name || 'N/A'}</td>
                                            <td className="p-3">{formatTime(record.clockIn)}</td>
                                            <td className="p-3">{record.clockOut ? formatTime(record.clockOut) : '-'}</td>
                                            <td className="p-3">{calculateHours(record.clockIn, record.clockOut)}</td>
                                            <td className="p-3">
                                                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700">
                                                    {record.mode}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${record.clockOut
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {record.clockOut ? 'Complete' : 'In Progress'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Legend */}
            <Card>
                <CardHeader>
                    <CardTitle>Legend</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-green-500"></div>
                            <span className="text-sm">Complete</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                            <span className="text-sm">In Progress</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                            <span className="text-sm">Office</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                            <span className="text-sm">WFH</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
