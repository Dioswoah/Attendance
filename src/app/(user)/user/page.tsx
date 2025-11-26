"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Clock, MapPin, Home, Building2, Coffee, LogOut } from "lucide-react"
import { useState, useMemo, useEffect } from "react"

interface Employee {
    id: string
    name: string
    department: {
        id: string
        name: string
    } | null
}

interface Department {
    id: string
    name: string
}

export default function UserDashboard() {
    const [status, setStatus] = useState<"clocked-out" | "clocked-in" | "on-break">("clocked-out")
    const [mode, setMode] = useState<string>("")
    const [name, setName] = useState<string>("")
    const [department, setDepartment] = useState<string>("")
    const [clockInTime, setClockInTime] = useState<string>("")
    const [loading, setLoading] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [departments, setDepartments] = useState<Department[]>([])

    // Fetch employees and departments on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [employeesRes, departmentsRes] = await Promise.all([
                    fetch('/api/employees'),
                    fetch('/api/departments')
                ])
                
                // Validate employees response
                if (employeesRes.ok) {
                    const employeesData = await employeesRes.json()
                    // Ensure it's an array before setting state
                    if (Array.isArray(employeesData)) {
                        setEmployees(employeesData)
                    } else {
                        console.error('Employees API returned non-array data:', employeesData)
                        setEmployees([])
                    }
                } else {
                    console.error('Failed to fetch employees:', employeesRes.status)
                    setEmployees([])
                }
                
                // Validate departments response
                if (departmentsRes.ok) {
                    const departmentsData = await departmentsRes.json()
                    // Ensure it's an array before setting state
                    if (Array.isArray(departmentsData)) {
                        setDepartments(departmentsData)
                    } else {
                        console.error('Departments API returned non-array data:', departmentsData)
                        setDepartments([])
                    }
                } else {
                    console.error('Failed to fetch departments:', departmentsRes.status)
                    setDepartments([])
                }
            } catch (error) {
                console.error('Error fetching data:', error)
                // Ensure arrays are set even on error
                setEmployees([])
                setDepartments([])
            }
        }
        fetchData()
    }, [])

    // Load existing attendance on mount and when name changes
    useEffect(() => {
        const checkTodayAttendance = async () => {
            if (name) {
                try {
                    const today = new Date().toISOString().split('T')[0]
                    const res = await fetch(`/api/attendance?date=${today}&userId=${name}`)
                    const data = await res.json()

                    if (data && data.length > 0) {
                        const record = data[0]
                        if (!record.clockOut) {
                            setStatus('clocked-in')
                            setMode(record.mode)
                            setClockInTime(new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
                        } else {
                            setStatus('clocked-out')
                            setClockInTime("")
                        }
                    } else {
                        setStatus('clocked-out')
                        setClockInTime("")
                    }
                } catch (error) {
                    console.error('Error fetching attendance:', error)
                }
            }
        }

        checkTodayAttendance()
    }, [name])

    // Filter employees by selected department
    const filteredEmployees = useMemo(() => {
        if (!department) return []
        return employees.filter(emp => emp.department?.id === department)
    }, [department, employees])

    // Reset name when department changes
    const handleDepartmentChange = (value: string) => {
        setDepartment(value)
        setName("") // Reset name selection when department changes
    }

    // Handle clock in
    const handleClockIn = async () => {
        const employee = employees.find((e: Employee) => e.id === name)
        if (employee && mode) {
            setLoading(true)
            try {
                const now = new Date().toISOString()
                const res = await fetch('/api/attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: name,
                        clockIn: now,
                        mode: mode.toUpperCase(),
                        status: 'PRESENT'
                    })
                })

                if (res.ok) {
                    const record = await res.json()
                    setStatus('clocked-in')
                    setClockInTime(new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
                }
            } catch (error) {
                console.error('Error clocking in:', error)
                alert('Failed to clock in. Please try again.')
            } finally {
                setLoading(false)
            }
        }
    }

    // Handle clock out
    const handleClockOut = async () => {
        setLoading(true)
        try {
            const today = new Date().toISOString().split('T')[0]
            const res = await fetch(`/api/attendance?date=${today}&userId=${name}`)
            const data = await res.json()

            if (data && data.length > 0) {
                const record = data[0]
                // Update the record with clock out time
                const updateRes = await fetch(`/api/attendance/${record.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clockOut: new Date().toISOString()
                    })
                })

                if (updateRes.ok) {
                    setStatus('clocked-out')
                    setClockInTime("")
                }
            }
        } catch (error) {
            console.error('Error clocking out:', error)
            alert('Failed to clock out. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full max-w-md">
            <Card className="shadow-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                        <Clock className="h-8 w-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-2xl">Redadair Attendance</CardTitle>
                    <CardDescription>Simple and efficient time tracking</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    {/* Status Indicator */}
                    <div className={`p-4 rounded-lg text-center border ${status === "clocked-in" ? "bg-green-50 border-green-200 text-green-700" :
                        status === "on-break" ? "bg-orange-50 border-orange-200 text-orange-700" :
                            "bg-slate-100 border-slate-200 text-slate-600"
                        }`}>
                        <p className="text-xs text-muted-foreground mb-1">
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p>
                        <p className="font-semibold text-lg">
                            {status === "clocked-in" ? "Currently Working" :
                                status === "on-break" ? "On Break" :
                                    "Ready to Clock In"}
                        </p>
                        {status === "clocked-in" && clockInTime && <p className="text-sm opacity-90">Clocked in at {clockInTime}</p>}
                    </div>

                    <div className="space-y-4">
                        {/* Department Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="department">Department</Label>
                            <Select value={department} onValueChange={handleDepartmentChange}>
                                <SelectTrigger id="department">
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Employee Name Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Select Your Name</Label>
                            <Select value={name} onValueChange={setName} disabled={!department}>
                                <SelectTrigger id="name">
                                    <SelectValue placeholder={department ? "Select your name" : "Select department first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredEmployees.map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Work Location */}
                        <div className="space-y-2">
                            <Label htmlFor="mode">Work Location</Label>
                            <Select value={mode} onValueChange={setMode} disabled={status === "clocked-in"}>
                                <SelectTrigger id="mode">
                                    <SelectValue placeholder="Select work location" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="office">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4" />
                                            Office
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="wfh">
                                        <div className="flex items-center gap-2">
                                            <Home className="h-4 w-4" />
                                            Work from Home
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="other">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4" />
                                            Other
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            {status === "clocked-out" ? (
                                <Button
                                    className="col-span-2 bg-green-600 hover:bg-green-700 h-12 text-lg"
                                    onClick={handleClockIn}
                                    disabled={!mode || !name || loading}
                                >
                                    <Clock className="mr-2 h-5 w-5" />
                                    {loading ? "Clocking In..." : "Clock In"}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        className="h-12 border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                                        disabled={loading}
                                    >
                                        <Coffee className="mr-2 h-5 w-5" />
                                        Break
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="h-12"
                                        onClick={handleClockOut}
                                        disabled={loading}
                                    >
                                        <LogOut className="mr-2 h-5 w-5" />
                                        {loading ? "Clocking Out..." : "Clock Out"}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Admin Portal Link */}
                    <div className="text-center pt-4 border-t">
                        <a href="/admin-login" className="text-sm text-blue-600 hover:underline">
                            Admin Portal
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
