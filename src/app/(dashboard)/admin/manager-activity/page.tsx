"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    ShieldCheck,
    UserCog,
    History,
    Search,
    CheckCircle2,
    XCircle,
    Trash2,
    AlertCircle,
    Loader2
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"

export default function ManagerActivityPage() {
    const [activeTab, setActiveTab] = useState<'logs' | 'control'>('logs')
    const [leaves, setLeaves] = useState<any[]>([])
    const [employees, setEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedManager, setSelectedManager] = useState<string | null>(null)
    const [managers, setManagers] = useState<any[]>([])

    // Action State
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [declineReason, setDeclineReason] = useState("")
    const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false)
    const [selectedLeafForAction, setSelectedLeafForAction] = useState<any>(null)
    const [attendanceRequests, setAttendanceRequests] = useState<any[]>([])

    const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))

    // Edit State
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<any>(null)
    const [editForm, setEditForm] = useState<any>({
        startDate: "",
        endDate: "",
        type: "",
        reason: "",
        status: "",
        startTime: "",
        endTime: "",
        time: ""
    })

    useEffect(() => {
        fetchData()
    }, [startDate, endDate])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [leavesRes, attRes, empRes] = await Promise.all([
                fetch(`/api/leaves?startDate=${startDate}&endDate=${endDate}`),
                fetch('/api/attendance-requests'), // Fetch all for admin view
                fetch('/api/employees')
            ])

            if (leavesRes.ok && empRes.ok && attRes.ok) {
                const leavesData = await leavesRes.json()
                const attData = await attRes.json()
                const employeesData = await empRes.json()

                // Merge logs
                const formattedLeaves = leavesData.map((l: any) => ({ ...l, kind: 'LEAVE' }))
                const formattedAtt = attData.map((a: any) => ({
                    ...a,
                    kind: 'ATTENDANCE',
                    userName: a.user.name,
                    userImage: a.user.image,
                    department: a.user.department?.name,
                    startDate: a.date,
                    endDate: a.date,
                    duration: 'N/A', // or calculate
                    type: a.type
                }))

                setLeaves([...formattedLeaves, ...formattedAtt]) // Using "leaves" state to hold both for now
                setEmployees(employeesData)

                // Filter for Managers (anyone with MANAGER or ADMIN role, or who is assigned as a manager to someone)
                // Actually, simplest is to look for explicit role or just list everyone? 
                // Creating a list of "Eligible Managers" usually implies role check.
                const mgrs = employeesData.filter((e: any) =>
                    e.roles?.includes('MANAGER') ||
                    e.roles?.includes('ADMIN') ||
                    employeesData.some((sub: any) => sub.managerId === e.id) // Also include anyone who IS a manager
                )
                // Dedup and sort
                const uniqueMgrs = Array.from(new Map(mgrs.map((m: any) => [m.id, m])).values())
                    .sort((a: any, b: any) => a.name.localeCompare(b.name))

                setManagers(uniqueMgrs)
            }
        } catch (error) {
            // Error handled
        } finally {
            setLoading(false)
        }
    }

    const getManagerOfUser = (userId: string) => {
        const user = employees.find(e => e.id === userId)
        if (!user || !user.managerId) return null
        return employees.find(e => e.id === user.managerId)
    }

    const handleStatusUpdate = async (item: any, status: 'APPROVED' | 'DECLINED', reason?: string) => {
        setProcessingId(item.id)
        const endpoint = item.kind === 'ATTENDANCE'
            ? `/api/attendance-requests/${item.id}`
            : `/api/leaves/${item.id}`

        try {
            const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, declineReason: reason })
            })

            if (res.ok) {
                toast.success(`Request ${status.toLowerCase()}`)
                setIsDeclineDialogOpen(false)
                fetchData() // Refresh data
            } else {
                toast.error("Failed to update status")
            }
        } catch (error) {
            toast.error("Error updating request")
        } finally {
            setProcessingId(null)
        }
    }

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingItem) return
        setProcessingId(editingItem.id)

        const endpoint = editingItem.kind === 'ATTENDANCE'
            ? `/api/attendance-requests/${editingItem.id}`
            : `/api/leaves/${editingItem.id}`

        try {
            const body: any = {
                status: editForm.status,
                type: editForm.type,
                reason: editForm.reason,
            }

            if (editingItem.kind === 'ATTENDANCE') {
                body.date = editForm.startDate
                body.time = `${editForm.startDate}T${editForm.time}:00`
            } else {
                body.startDate = editForm.startDate
                body.endDate = editForm.endDate
                if (editForm.startTime) body.startTime = `${editForm.startDate}T${editForm.startTime}:00`
                if (editForm.endTime) body.endTime = `${editForm.endDate}T${editForm.endTime}:00`
            }

            const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                toast.success("Record updated successfully")
                setIsEditDialogOpen(false)
                fetchData()
            } else {
                toast.error("Failed to update record")
            }
        } catch (error) {
            toast.error("Error updating record")
        } finally {
            setProcessingId(null)
        }
    }

    const handleDelete = async (item: any) => {
        if (!confirm("Are you sure you want to delete this record? This cannot be undone.")) return

        setProcessingId(item.id)
        const endpoint = item.kind === 'ATTENDANCE'
            ? `/api/attendance-requests/${item.id}`
            : `/api/leaves/${item.id}`

        try {
            const res = await fetch(endpoint, {
                method: 'DELETE'
            })

            if (res.ok) {
                toast.success("Record deleted")
                fetchData()
            } else {
                toast.error("Failed to delete record")
            }
        } catch (error) {
            toast.error("Error deleting record")
        } finally {
            setProcessingId(null)
        }
    }

    // Helper to get leaves for selected manager
    const getManagerLeaves = (managerId: string) => {
        // Find users who report to this manager
        const reportingUserIds = employees
            .filter(e => e.managerId === managerId)
            .map(e => e.id)

        return leaves.filter(l => reportingUserIds.includes(l.userId))
    }

    const renderActionButtons = (leaf: any) => (
        <div className="flex items-center justify-end gap-2">
            {leaf.status === 'PENDING' ? (
                <>
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                        onClick={() => handleStatusUpdate(leaf, 'APPROVED')}
                        disabled={!!processingId}
                        title="Approve"
                    >
                        {processingId === leaf.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    </Button>
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                            setSelectedLeafForAction(leaf)
                            setDeclineReason(leaf.declineReason || "")
                            setIsDeclineDialogOpen(true)
                        }}
                        disabled={!!processingId}
                        title="Decline"
                    >
                        <XCircle className="h-4 w-4" />
                    </Button>
                </>
            ) : (
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
                        onClick={() => {
                            setEditingItem(leaf)
                            setEditForm({
                                startDate: leaf.startDate?.split('T')[0] || leaf.startDate || leaf.date?.split('T')[0] || "",
                                endDate: leaf.endDate?.split('T')[0] || leaf.endDate || "",
                                type: leaf.type,
                                reason: leaf.reason,
                                status: leaf.status,
                                startTime: leaf.startTime ? new Date(leaf.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila' }) : "",
                                endTime: leaf.endTime ? new Date(leaf.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila' }) : "",
                                time: leaf.time ? new Date(leaf.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila' }) : ""
                            })
                            setIsEditDialogOpen(true)
                        }}
                        disabled={!!processingId}
                    >
                        Edit
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-700 hover:bg-slate-50 px-2"
                        onClick={() => {
                            if (leaf.status === 'APPROVED') {
                                setSelectedLeafForAction(leaf)
                                setDeclineReason(leaf.declineReason || "")
                                setIsDeclineDialogOpen(true)
                            } else {
                                handleStatusUpdate(leaf, 'APPROVED')
                            }
                        }}
                        disabled={!!processingId}
                    >
                        Modify
                    </Button>
                </div>
            )}
            <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                onClick={() => handleDelete(leaf)}
                disabled={!!processingId}
                title="Delete Record"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    )

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-10 px-4 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Manager Activity</h1>
                    <p className="text-muted-foreground text-sm">Audit logs and administrative override for manager actions</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={activeTab === 'logs' ? "default" : "outline"}
                        onClick={() => setActiveTab('logs')}
                        className="gap-2"
                    >
                        <History className="h-4 w-4" />
                        Action Logs
                    </Button>
                    <Button
                        variant={activeTab === 'control' ? "default" : "outline"}
                        onClick={() => setActiveTab('control')}
                        className="gap-2"
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Manager Control
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-border shadow-sm">
                <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filter Range:</span>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-9 w-40 text-sm"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-9 w-40 text-sm"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {activeTab === 'logs' && (
                        <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                            <CardHeader className="bg-muted/10 border-b border-border">
                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <History className="h-5 w-5 text-muted-foreground" />
                                    Review Activity Log
                                </CardTitle>
                                <CardDescription>Recent actions taken on leave requests across all managers</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-6">Request Date</TableHead>
                                            <TableHead>Staff</TableHead>
                                            <TableHead>Manager</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right pr-6">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {leaves
                                            .filter(l => l.status !== 'PENDING') // Show only processed items
                                            .map(leaf => {
                                                const manager = getManagerOfUser(leaf.userId)
                                                return (
                                                    <TableRow key={leaf.id}>
                                                        <TableCell className="pl-6 font-medium text-muted-foreground">
                                                            {new Date(leaf.createdAt || new Date().toISOString()).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila' })}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{leaf.userName}</span>
                                                                <span className="text-xs text-muted-foreground">{leaf.department}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                                                                    {manager?.name?.charAt(0) || "?"}
                                                                </div>
                                                                <span className="text-sm">{manager?.name || "Unassigned"}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{leaf.type}</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1.5 items-start">
                                                                <Badge className={
                                                                    leaf.status === 'APPROVED' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                                                        "bg-red-100 text-red-700 hover:bg-red-100"
                                                                }>
                                                                    {leaf.status}
                                                                </Badge>
                                                                {leaf.status === 'DECLINED' && leaf.declineReason && (
                                                                    <span className="text-[10px] text-muted-foreground max-w-[200px] truncate bg-muted px-1.5 py-0.5 rounded-sm" title={leaf.declineReason}>
                                                                        "{leaf.declineReason}"
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="pr-6">
                                                            {renderActionButtons(leaf)}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'control' && (
                        <div className="space-y-6">
                            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                                <CardHeader className="bg-muted/10 border-b border-border pb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                                <UserCog className="h-5 w-5 text-muted-foreground" />
                                                Select Manager context
                                            </CardTitle>
                                            <CardDescription>View and manage requests as a specific manager</CardDescription>
                                        </div>
                                        <div className="w-[300px]">
                                            <Select value={selectedManager || "select"} onValueChange={setSelectedManager}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a manager..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="select" disabled>Select a manager...</SelectItem>
                                                    {managers.map(m => (
                                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>

                            {selectedManager && (
                                <div className="grid grid-cols-1 gap-6">
                                    {/* Pending Requests */}
                                    <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                                        <CardHeader className="bg-amber-50/50 border-b border-amber-100">
                                            <div className="flex items-center gap-2">
                                                <AlertCircle className="h-5 w-5 text-amber-600" />
                                                <CardTitle className="text-base font-semibold text-amber-900">Pending Actions</CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="pl-6">Staff</TableHead>
                                                        <TableHead>Dates</TableHead>
                                                        <TableHead>Type</TableHead>
                                                        <TableHead>Duration</TableHead>
                                                        <TableHead className="text-right pr-6">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {getManagerLeaves(selectedManager)
                                                        .filter(l => l.status === 'PENDING')
                                                        .map(leaf => (
                                                            <TableRow key={leaf.id}>
                                                                <TableCell className="pl-6 font-medium">{leaf.userName}</TableCell>
                                                                <TableCell className="text-muted-foreground text-sm">
                                                                    {format(parseISO(leaf.startDate), "MMM dd")} - {format(parseISO(leaf.endDate), "MMM dd")}
                                                                </TableCell>
                                                                <TableCell><Badge variant="outline">{leaf.type}</Badge></TableCell>
                                                                <TableCell className="text-sm">{leaf.duration}</TableCell>
                                                                <TableCell className="pr-6">
                                                                    {renderActionButtons(leaf)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    {getManagerLeaves(selectedManager).filter(l => l.status === 'PENDING').length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                                No pending requests for this manager
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>

                                    {/* History */}
                                    <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white opacity-80">
                                        <CardHeader className="bg-muted/10 border-b border-border">
                                            <div className="flex items-center gap-2">
                                                <History className="h-5 w-5 text-muted-foreground" />
                                                <CardTitle className="text-base font-semibold text-foreground">Action History</CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="pl-6">Staff</TableHead>
                                                        <TableHead>Dates</TableHead>
                                                        <TableHead>Type</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right pr-6">Manage</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {getManagerLeaves(selectedManager)
                                                        .filter(l => l.status !== 'PENDING')
                                                        .map(leaf => (
                                                            <TableRow key={leaf.id}>
                                                                <TableCell className="pl-6 font-medium">{leaf.userName}</TableCell>
                                                                <TableCell className="text-muted-foreground text-sm">
                                                                    {format(parseISO(leaf.startDate), "MMM dd")} - {format(parseISO(leaf.endDate), "MMM dd")}
                                                                </TableCell>
                                                                <TableCell><Badge variant="outline">{leaf.type}</Badge></TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col gap-1.5 items-start">
                                                                        <Badge className={leaf.status === 'APPROVED' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                                                                            {leaf.status}
                                                                        </Badge>
                                                                        {leaf.status === 'DECLINED' && leaf.declineReason && (
                                                                            <span className="text-[10px] text-muted-foreground max-w-[200px] truncate bg-muted px-1.5 py-0.5 rounded-sm" title={leaf.declineReason}>
                                                                                "{leaf.declineReason}"
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="pr-6">
                                                                    {renderActionButtons(leaf)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    {getManagerLeaves(selectedManager).filter(l => l.status !== 'PENDING').length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                                No history available
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <Dialog open={isDeclineDialogOpen} onOpenChange={setIsDeclineDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Decline Request</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for declining this request.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Reason</Label>
                            <Textarea
                                value={declineReason}
                                onChange={e => setDeclineReason(e.target.value)}
                                placeholder="e.g. Insufficient staffing coverage..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeclineDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => selectedLeafForAction && handleStatusUpdate(selectedLeafForAction, 'DECLINED', declineReason)}
                            disabled={!declineReason.trim() || !!processingId}
                        >
                            {processingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Decline"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserCog className="h-5 w-5" />
                            Edit Request Details
                        </DialogTitle>
                        <DialogDescription>
                            Modify the core details of this {editingItem?.kind.toLowerCase()} record.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Type</Label>
                                <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {editingItem?.kind === 'ATTENDANCE' ? (
                                            <>
                                                <SelectItem value="CLOCK_IN">Clock In</SelectItem>
                                                <SelectItem value="CLOCK_OUT">Clock Out</SelectItem>
                                                <SelectItem value="BREAK_START">Break Start</SelectItem>
                                                <SelectItem value="BREAK_END">Break End</SelectItem>
                                            </>
                                        ) : (
                                            <>
                                                <SelectItem value="ANNUAL">Annual Leave</SelectItem>
                                                <SelectItem value="SICK">Sick Leave</SelectItem>
                                                <SelectItem value="PERSONAL">Personal Leave</SelectItem>
                                                <SelectItem value="MATERNITY">Maternity</SelectItem>
                                                <SelectItem value="OTHER">Other</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Status</Label>
                                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="APPROVED">Approved</SelectItem>
                                        <SelectItem value="DECLINED">Declined</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">{editingItem?.kind === 'ATTENDANCE' ? 'Date' : 'Start Date'}</Label>
                                <Input
                                    type="date"
                                    value={editForm.startDate}
                                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                                />
                            </div>
                            {editingItem?.kind === 'LEAVE' && (
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">End Date</Label>
                                    <Input
                                        type="date"
                                        value={editForm.endDate}
                                        onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {editingItem?.kind === 'ATTENDANCE' ? (
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Time</Label>
                                    <Input
                                        type="time"
                                        value={editForm.time}
                                        onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase font-bold text-muted-foreground">Start Time</Label>
                                        <Input
                                            type="time"
                                            value={editForm.startTime}
                                            onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase font-bold text-muted-foreground">End Time</Label>
                                        <Input
                                            type="time"
                                            value={editForm.endTime}
                                            onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Reason</Label>
                            <Textarea
                                value={editForm.reason}
                                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                                className="h-20"
                            />
                        </div>

                        <DialogFooter className="pt-4">
                            <Button variant="outline" type="button" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={!!processingId}>
                                {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
