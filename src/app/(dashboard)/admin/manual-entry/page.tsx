"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ClipboardList, Calendar, Coffee } from "lucide-react"

interface Employee {
    id: string
    name: string
}

export default function ManualEntryPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [selectedEmployee, setSelectedEmployee] = useState("")
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [clockInTime, setClockInTime] = useState("")
    const [clockOutTime, setClockOutTime] = useState("")
    const [mode, setMode] = useState("OFFICE")
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchEmployees()
    }, [])

    const fetchEmployees = async () => {
        try {
            const res = await fetch('/api/employees')
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data)) {
                    setEmployees(data)
                } else {
                    console.error('Employees API returned non-array data:', data)
                    setEmployees([])
                }
            } else {
                console.error('Failed to fetch employees:', res.status)
                setEmployees([])
            }
        } catch (error) {
            console.error('Error fetching employees:', error)
            setEmployees([])
        }
    }

    const handleManualAttendance = async () => {
        if (!selectedEmployee || !date || !clockInTime) {
            alert('Please fill in all required fields')
            return
        }

        setLoading(true)
        try {
            const clockInDateTime = new Date(`${date}T${clockInTime}`)
            const clockOutDateTime = clockOutTime ? new Date(`${date}T${clockOutTime}`) : null

            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedEmployee,
                    clockIn: clockInDateTime.toISOString(),
                    clockOut: clockOutDateTime?.toISOString(),
                    mode,
                    status: 'PRESENT'
                })
            })

            if (res.ok) {
                alert('Attendance recorded successfully!')
                // Reset form
                setSelectedEmployee("")
                setClockInTime("")
                setClockOutTime("")
            } else {
                alert('Failed to record attendance')
            }
        } catch (error) {
            console.error('Error recording attendance:', error)
            alert('Failed to record attendance')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Manual Entry</h1>
                <p className="text-muted-foreground">Manually record attendance, leaves, and breaks.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Manual Attendance Entry */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-blue-600" />
                            <CardTitle>Manual Attendance</CardTitle>
                        </div>
                        <CardDescription>Record attendance for employees</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Employee</Label>
                            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Clock In Time</Label>
                            <Input
                                type="time"
                                value={clockInTime}
                                onChange={(e) => setClockInTime(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Clock Out Time (Optional)</Label>
                            <Input
                                type="time"
                                value={clockOutTime}
                                onChange={(e) => setClockOutTime(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Work Mode</Label>
                            <Select value={mode} onValueChange={setMode}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="OFFICE">Office</SelectItem>
                                    <SelectItem value="WFH">Work from Home</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            className="w-full"
                            onClick={handleManualAttendance}
                            disabled={loading}
                        >
                            {loading ? "Recording..." : "Record Attendance"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Leave Entry */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-orange-600" />
                            <CardTitle>Leave Entry</CardTitle>
                        </div>
                        <CardDescription>Record employee leaves</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Employee</Label>
                            <Select>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Leave Type</Label>
                            <Select>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sick">Sick Leave</SelectItem>
                                    <SelectItem value="vacation">Vacation</SelectItem>
                                    <SelectItem value="personal">Personal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input type="date" />
                        </div>

                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input type="date" />
                        </div>

                        <Button className="w-full">Record Leave</Button>
                    </CardContent>
                </Card>

                {/* Break Entry */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Coffee className="h-5 w-5 text-purple-600" />
                            <CardTitle>Break Entry</CardTitle>
                        </div>
                        <CardDescription>Record employee breaks</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Employee</Label>
                            <Select>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>

                        <div className="space-y-2">
                            <Label>Break Start</Label>
                            <Input type="time" />
                        </div>

                        <div className="space-y-2">
                            <Label>Break End</Label>
                            <Input type="time" />
                        </div>

                        <Button className="w-full">Record Break</Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
