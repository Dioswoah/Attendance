"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download } from "lucide-react"
import * as XLSX from 'xlsx'

interface Department {
    id: string
    name: string
}

export default function ReportsPage() {
    const [departments, setDepartments] = useState<Department[]>([])
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [selectedDepartment, setSelectedDepartment] = useState("all")
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchDepartments()
    }, [])

    const fetchDepartments = async () => {
        try {
            const res = await fetch('/api/departments')
            const data = await res.json()
            setDepartments(data)
        } catch (error) {
            console.error('Error fetching departments:', error)
        }
    }

    const handleExport = async () => {
        setLoading(true)
        try {
            // Fetch attendance records for the date range
            const start = new Date(startDate)
            const end = new Date(endDate)
            const allRecords: any[] = []

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0]
                const res = await fetch(`/api/attendance?date=${dateStr}`)
                const records = await res.json()
                allRecords.push(...records)
            }

            // Filter by department if selected
            const filteredRecords = selectedDepartment === "all"
                ? allRecords
                : allRecords.filter((r: any) => r.user.department?.name === selectedDepartment)

            if (filteredRecords.length === 0) {
                alert('No records found for the selected date range and department.')
                setLoading(false)
                return
            }

            // Generate Excel data
            const excelData = filteredRecords.map(record => {
                const clockIn = new Date(record.clockIn)
                const clockOut = record.clockOut ? new Date(record.clockOut) : null
                const hoursWorked = clockOut
                    ? ((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)).toFixed(2)
                    : '0.00'

                return {
                    'Date': new Date(record.date).toLocaleDateString(),
                    'Staff Name': record.user.name,
                    'Department': record.user.department?.name || 'N/A',
                    'Clock In': clockIn.toLocaleTimeString(),
                    'Clock Out': clockOut ? clockOut.toLocaleTimeString() : 'N/A',
                    'Hours Worked': hoursWorked,
                    'Status': record.clockOut ? 'Complete' : 'Partial',
                    'Mode': record.mode
                }
            })

            // Create workbook and worksheet
            const wb = XLSX.utils.book_new()
            const ws = XLSX.utils.json_to_sheet(excelData)

            // Set column widths for better readability
            const wscols = [
                { wch: 12 }, // Date
                { wch: 20 }, // Staff Name
                { wch: 20 }, // Department
                { wch: 12 }, // Clock In
                { wch: 12 }, // Clock Out
                { wch: 15 }, // Hours Worked
                { wch: 12 }, // Status
                { wch: 10 }  // Mode
            ]
            ws['!cols'] = wscols

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Attendance')

            // Download Excel file
            const fileName = `attendance-report-${startDate}-to-${endDate}.xlsx`
            XLSX.writeFile(wb, fileName)

            // Show success message
            alert(`Successfully exported ${filteredRecords.length} records to ${fileName}`)
        } catch (error) {
            console.error('Error exporting data:', error)
            alert(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setLoading(false)
        }
    }

    const setQuickRange = (days: number) => {
        const end = new Date()
        const start = new Date()
        start.setDate(start.getDate() - days)
        setStartDate(start.toISOString().split('T')[0])
        setEndDate(end.toISOString().split('T')[0])
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Export Data</h1>
                <p className="text-muted-foreground">Export attendance data to Excel format for payroll processing.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Export Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
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

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Quick Date Ranges</label>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => setQuickRange(7)}>
                                Last 7 days
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setQuickRange(30)}>
                                Last 30 days
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setQuickRange(90)}>
                                Last 90 days
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => {
                                const now = new Date()
                                const start = new Date(now.getFullYear(), now.getMonth(), 1)
                                setStartDate(start.toISOString().split('T')[0])
                                setEndDate(now.toISOString().split('T')[0])
                            }}>
                                This Month
                            </Button>
                        </div>
                    </div>

                    <Button onClick={handleExport} disabled={loading} className="w-full md:w-auto">
                        <Download className="mr-2 h-4 w-4" />
                        {loading ? 'Exporting...' : 'Export to Excel'}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Excel Export Format</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        The exported Excel file will contain the following columns:
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="font-medium">Date:</p>
                            <p className="text-muted-foreground">YYYY-MM-DD format</p>
                        </div>
                        <div>
                            <p className="font-medium">Staff Name:</p>
                            <p className="text-muted-foreground">Full name</p>
                        </div>
                        <div>
                            <p className="font-medium">Department:</p>
                            <p className="text-muted-foreground">Department name</p>
                        </div>
                        <div>
                            <p className="font-medium">Clock In:</p>
                            <p className="text-muted-foreground">Timestamp</p>
                        </div>
                        <div>
                            <p className="font-medium">Clock Out:</p>
                            <p className="text-muted-foreground">Timestamp</p>
                        </div>
                        <div>
                            <p className="font-medium">Hours Worked:</p>
                            <p className="text-muted-foreground">Decimal format</p>
                        </div>
                        <div>
                            <p className="font-medium">Status:</p>
                            <p className="text-muted-foreground">Complete, Partial, etc.</p>
                        </div>
                        <div>
                            <p className="font-medium">Mode:</p>
                            <p className="text-muted-foreground">OFFICE, WFH, OTHER</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
