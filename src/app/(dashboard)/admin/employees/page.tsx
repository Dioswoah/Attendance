"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Mail, User, Building, Trash2, Edit2, Loader2, ShieldCheck, MailIcon, Flame, UserPlus, Archive, ArchiveRestore, MapPin, AlertTriangle, Clock, LogOut, Globe, ChevronDown } from "lucide-react"
import { statusConfig } from "@/components/UserStatusDropdown"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { getBrowserTimezone } from "@/lib/timezone"
import { UserAvatar } from "@/components/UserAvatar"

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<any[]>([])
    const [departments, setDepartments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    // New employee state
    const [newName, setNewName] = useState("")
    const [newEmail, setNewEmail] = useState("")
    const [newDeptId, setNewDeptId] = useState("")
    const [newSecondaryDeptIds, setNewSecondaryDeptIds] = useState<string[]>([])
    const [newRoles, setNewRoles] = useState<string[]>(["USER"])
    const [newManagerId, setNewManagerId] = useState("")
    const [newLocation, setNewLocation] = useState("")
    const [newShiftStart, setNewShiftStart] = useState("09:00")
    const [newShiftEnd, setNewShiftEnd] = useState("17:00")
    const [isAddOpen, setIsAddOpen] = useState(false)

    // Edit state
    const [editingEmp, setEditingEmp] = useState<any>(null)
    const [editName, setEditName] = useState("")
    const [editEmail, setEditEmail] = useState("")
    const [editDeptId, setEditDeptId] = useState("")
    const [editSecondaryDeptIds, setEditSecondaryDeptIds] = useState<string[]>([])
    const [editRoles, setEditRoles] = useState<string[]>([])
    const [editManagerId, setEditManagerId] = useState("")
    const [editLocation, setEditLocation] = useState("")
    const [editShiftStart, setEditShiftStart] = useState("09:00")
    const [editShiftEnd, setEditShiftEnd] = useState("17:00")
    const [editWorkingDays, setEditWorkingDays] = useState<string[]>(["MON","TUE","WED","THU","FRI"])

    const ALL_DAYS = ["MON","TUE","WED","THU","FRI","SAT","SUN"]
    const DAY_LABELS: Record<string,string> = { MON:"Mon", TUE:"Tue", WED:"Wed", THU:"Thu", FRI:"Fri", SAT:"Sat", SUN:"Sun" }

    const toggleEditWorkingDay = (day: string) => {
        setEditWorkingDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
    }
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)

    const [showArchived, setShowArchived] = useState(false)
    const [deptFilter, setDeptFilter] = useState("all")
    const [roleFilter, setRoleFilter] = useState("all")
    const [managerFilter, setManagerFilter] = useState("all")
    const [sortBy, setSortBy] = useState("name")
    const [showDeptWarning, setShowDeptWarning] = useState(false)
    const [isManagerSelectOpen, setIsManagerSelectOpen] = useState(false)

    // Bulk Actions
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isBulkProcessing, setIsBulkProcessing] = useState(false)
    const [isDSTDialogOpen, setIsDSTDialogOpen] = useState(false)

    // Bulk Reassign
    const [isReassignOpen, setIsReassignOpen] = useState(false)
    const [reassignFromId, setReassignFromId] = useState("")
    const [reassignToId, setReassignToId] = useState("")
    const [isReassigning, setIsReassigning] = useState(false)

    // Timezone Handling
    const { data: session } = useSession()
    const userPrefs = session?.user as any
    const effectiveTimezone = userPrefs?.useCurrentTimezone !== false
        ? (typeof window !== 'undefined' ? getBrowserTimezone() : 'Asia/Manila')
        : (userPrefs?.selectedTimezone || 'Asia/Manila')

    const formatShiftTime = (timeStr: string, empTz?: string) => {
        if (!timeStr) return "N/A"
        try {
            const baseTz = empTz || 'Asia/Manila'
            const [h, m] = timeStr.split(':').map(Number)

            const getOffsetInMinutes = (tz: string) => {
                const now = new Date()
                const tzString = now.toLocaleString('en-US', { timeZone: tz, hour12: false })
                const [datePart, timePart] = tzString.split(', ')
                const [mon, day, year] = datePart.split('/').map(Number)
                const [hh, mm, ss] = timePart.split(':').map(Number)
                
                const tzDate = new Date(year, mon - 1, day, hh, mm, ss)
                const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false }))
                const [uMon, uDay, uYear] = utcDate.toLocaleString('en-US', { timeZone: 'UTC' }).split(', ')[0].split('/').map(Number)
                const [uH, uM, uS] = utcDate.toLocaleString('en-US', { timeZone: 'UTC', hour12: false }).split(', ')[1].split(':').map(Number)
                const utcRef = new Date(uYear, uMon - 1, uDay, uH, uM, uS)
                
                return Math.round((tzDate.getTime() - utcRef.getTime()) / 60000)
            }

            const baseOffset = getOffsetInMinutes(baseTz)
            const targetOffset = getOffsetInMinutes(effectiveTimezone)
            const diffMinutes = targetOffset - baseOffset

            // Calculate the new time
            const totalMinutes = (h * 60 + m + diffMinutes + 1440) % 1440
            const finalH = Math.floor(totalMinutes / 60)
            const finalM = totalMinutes % 60

            return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`
        } catch (e) {
            return timeStr
        }
    }

    // Confirmation Dialog State
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string
        description: string
        action: () => Promise<void>
        variant?: "default" | "destructive"
    } | null>(null)

    const executeConfirm = async () => {
        if (!confirmConfig?.action) return
        setIsConfirming(true)
        try {
            await confirmConfig.action()
        } finally {
            setIsConfirming(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [empRes, deptRes] = await Promise.all([
                fetch('/api/employees'),
                fetch('/api/departments')
            ])
            if (empRes.ok && deptRes.ok) {
                setEmployees(await empRes.json())
                setDepartments(await deptRes.json())
            }
        } catch (error) {
            // Error handled
        } finally {
            setLoading(false)
        }
    }

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            const res = await fetch('/api/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName,
                    email: newEmail,
                    departmentId: newDeptId || null,
                    secondaryDepartmentIds: newSecondaryDeptIds,
                    roles: newRoles,
                    managerId: newManagerId && newManagerId !== "unassigned" ? newManagerId : null,
                    location: newLocation,
                    shiftStartTime: newShiftStart,
                    shiftEndTime: newShiftEnd
                })
            })
            if (res.ok) {
                toast.success("Staff member created successfully")
                setIsAddOpen(false)
                setNewName("")
                setNewEmail("")
                setNewDeptId("")
                setNewSecondaryDeptIds([])
                setNewRoles(["USER"])
                setNewManagerId("")
                setNewLocation("")
                setNewShiftStart("09:00")
                setNewShiftEnd("17:00")
                fetchData()
            } else {
                const data = await res.json()
                toast.error(data.error || "Failed to create staff member")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
            console.error("Failed to add employee")
        } finally {
            setIsSaving(false)
        }
    }

    const handleEditClick = (emp: any) => {
        setEditingEmp(emp)
        setEditName(emp.name || "")
        setEditEmail(emp.email || "")
        setEditDeptId(emp.departmentId || "")
        setEditSecondaryDeptIds((emp.secondaryDepartments || []).map((d: any) => d.id))
        // Handle migration from single role to roles array if needed
        setEditRoles(emp.roles || (emp.role ? [emp.role] : ["USER"]))
        setEditManagerId(emp.managerId || "")
        setEditLocation(emp.employmentLocation || "")
        setEditShiftStart(emp.shiftStartTime || "09:00")
        setEditShiftEnd(emp.shiftEndTime || "17:00")
        setEditWorkingDays(emp.workingDays ? emp.workingDays.split(',') : ["MON","TUE","WED","THU","FRI"])
        setIsEditOpen(true)
    }

    const handleUpdateEmployee = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingEmp) return
        setIsSaving(true)
        try {
            const res = await fetch(`/api/employees/${editingEmp.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName,
                    email: editEmail,
                    departmentId: (editDeptId && editDeptId !== "unassigned") ? editDeptId : null,
                    secondaryDepartmentIds: editSecondaryDeptIds,
                    roles: editRoles,
                    managerId: (editManagerId && editManagerId !== "unassigned") ? editManagerId : null,
                    location: editLocation,
                    shiftStartTime: editShiftStart,
                    shiftEndTime: editShiftEnd,
                    workingDays: editWorkingDays
                })
            })
            if (res.ok) {
                toast.success("Staff member updated successfully")
                setIsEditOpen(false)
                fetchData()
            } else {
                const data = await res.json()
                toast.error(data.error || "Failed to update staff member")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
            console.error("Error updating staff member:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleArchiveEmployee = (id: string, archive: boolean) => {
        const action = archive ? "archive" : "unarchive"

        setConfirmConfig({
            title: `Confirm ${archive ? 'Archive' : 'Restore'}`,
            description: `Are you sure you want to ${action} this staff member? ${archive ? 'They will be moved to the archived list.' : 'They will be restored to the active list.'}`,
            variant: "default",
            action: async () => {
                try {
                    const res = await fetch(`/api/employees/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isArchived: archive })
                    })
                    if (res.ok) {
                        toast.success(`Staff member ${archive ? 'archived' : 'restored'} successfully`)
                        fetchData()
                        setConfirmOpen(false)
                    } else {
                        toast.error("Failed to update staff member")
                    }
                } catch (error) {
                    toast.error("An error occurred while updating staff member")
                }
            }
        })
        setConfirmOpen(true)
    }

    const handleDeleteEmployee = (id: string) => {
        setConfirmConfig({
            title: "Delete Staff Member",
            description: "Are you sure you want to PERMANENTLY delete this staff member? This action cannot be undone and will remove all associated records.",
            variant: "destructive",
            action: async () => {
                try {
                    const res = await fetch(`/api/employees/${id}`, {
                        method: 'DELETE'
                    })
                    if (res.ok) {
                        toast.success("Staff member deleted successfully")
                        fetchData()
                        setConfirmOpen(false)
                    } else {
                        toast.error("Failed to delete staff member")
                    }
                } catch (error) {
                    toast.error("An error occurred while deleting staff member")
                }
            }
        })
        setConfirmOpen(true)
    }

    const handleForceLogout = (id: string, name: string) => {
        setConfirmConfig({
            title: "Force Sign Out",
            description: `Are you sure you want to force sign out ${name || 'this user'}? This will immediately terminate all their active sessions.`,
            variant: "destructive",
            action: async () => {
                setProcessingId(id)
                try {
                    const res = await fetch(`/api/employees/${id}/force-logout`, {
                        method: 'POST'
                    })
                    if (res.ok) {
                        toast.success(`Successfully signed out ${name || 'user'}`)
                        setConfirmOpen(false)
                    } else {
                        const data = await res.json()
                        toast.error(data.error || "Failed to force sign out user")
                    }
                } catch (error) {
                    toast.error("An error occurred while attempting to sign out user")
                } finally {
                    setProcessingId(null)
                }
            }
        })
        setConfirmOpen(true)
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredEmployees.map(e => e.id)))
        } else {
            setSelectedIds(new Set())
        }
    }

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds)
        if (checked) newSelected.add(id)
        else newSelected.delete(id)
        setSelectedIds(newSelected)
    }

    const handleBulkArchive = (archive: boolean) => {
        const action = archive ? "archive" : "unarchive"

        setConfirmConfig({
            title: `Bulk ${archive ? 'Archive' : 'Restore'}`,
            description: `Are you sure you want to ${action} ${selectedIds.size} staff members?`,
            variant: "default",
            action: async () => {
                setIsBulkProcessing(true)
                try {
                    await Promise.all(Array.from(selectedIds).map(id =>
                        fetch(`/api/employees/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ isArchived: archive })
                        })
                    ))
                    toast.success(`${selectedIds.size} staff members ${archive ? 'archived' : 'restored'} successfully`)
                    setSelectedIds(new Set())
                    fetchData()
                    setConfirmOpen(false)
                } catch (error) {
                    console.error("Bulk action failed", error)
                    toast.error("Failed to perform bulk action")
                } finally {
                    setIsBulkProcessing(false)
                }
            }
        })
        setConfirmOpen(true)
    }

    const handleBulkDelete = () => {
        setConfirmConfig({
            title: "Bulk Delete Staff",
            description: `Are you sure you want to PERMANENTLY delete ${selectedIds.size} staff members? This action cannot be undone.`,
            variant: "destructive",
            action: async () => {
                setIsBulkProcessing(true)
                try {
                    await Promise.all(Array.from(selectedIds).map(id =>
                        fetch(`/api/employees/${id}`, { method: 'DELETE' })
                    ))
                    toast.success(`${selectedIds.size} staff members deleted successfully`)
                    setSelectedIds(new Set())
                    fetchData()
                    setConfirmOpen(false)
                } catch (error) {
                    console.error("Bulk delete failed", error)
                    toast.error("Failed to delete staff members")
                } finally {
                    setIsBulkProcessing(false)
                }
            }
        })
        setConfirmOpen(true)
    }

    const adjustTime = (timeStr: string, hours: number): string => {
        if (!timeStr) return timeStr;
        const [h, m] = timeStr.split(':').map(Number);
        const totalMinutes = (h * 60 + m + (hours * 60) + 1440) % 1440;
        const newH = Math.floor(totalMinutes / 60);
        const newM = totalMinutes % 60;
        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    }

    const handleBulkDSTAdjustment = (hours: number) => {
        setConfirmConfig({
            title: "Confirm DST Adjustment",
            description: `This will move the work hours for ${selectedIds.size} selected staff members ${hours > 0 ? 'forward' : 'back'} by 1 hour. Continue?`,
            variant: "default",
            action: async () => {
                setIsBulkProcessing(true)
                try {
                    const updates = Array.from(selectedIds).map(id => {
                        const emp = employees.find(e => e.id === id)
                        if (!emp) return null

                        const newStart = adjustTime(emp.shiftStartTime || "09:00", hours)
                        const newEnd = adjustTime(emp.shiftEndTime || "17:00", hours)

                        return fetch(`/api/employees/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                shiftStartTime: newStart,
                                shiftEndTime: newEnd
                            })
                        })
                    }).filter(Boolean) as Promise<Response>[]

                    await Promise.all(updates)
                    toast.success(`Successfully adjusted work hours for ${selectedIds.size} staff members`)
                    setSelectedIds(new Set())
                    fetchData()
                    setConfirmOpen(false)
                    setIsDSTDialogOpen(false)
                } catch (error) {
                    console.error("Bulk adjustment failed", error)
                    toast.error("Failed to adjust work hours")
                } finally {
                    setIsBulkProcessing(false)
                }
            }
        })
        setConfirmOpen(true)
    }

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesArchive = showArchived ? emp.isArchived : !emp.isArchived
        const matchesDept = deptFilter === "all" ||
            emp.departmentId === deptFilter ||
            (emp.secondaryDepartments || []).some((d: any) => d.id === deptFilter)
        const currentRoles = emp.roles || (emp.role ? [emp.role] : [])
        const matchesRole = roleFilter === "all" ? true :
            roleFilter === "USER_ONLY" ? currentRoles.length === 1 && currentRoles.includes("USER") :
                currentRoles.includes(roleFilter)
        const matchesManager = managerFilter === "all" ? true :
            managerFilter === "none" ? !emp.managerId :
                emp.managerId === managerFilter

        return matchesSearch && matchesArchive && matchesDept && matchesRole && matchesManager
    }).sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
        if (sortBy === 'department') {
            const deptA = a.department?.name || 'Unassigned'
            const deptB = b.department?.name || 'Unassigned'
            return deptA.localeCompare(deptB)
        }
        if (sortBy === 'manager') {
            const mgrA = a.manager?.name || 'No Manager'
            const mgrB = b.manager?.name || 'No Manager'
            return mgrA.localeCompare(mgrB)
        }
        return 0
    })

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-sm overflow-hidden animate-bounce p-2">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Staff Directory...</p>
            </div>
        )
    }

    return (
        <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-10 px-4 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Staff Management</h1>
                    <p className="text-muted-foreground text-sm">Staff Directory & Operational Clearance</p>
                </div>

                <div className="flex items-center gap-2">
                    <Dialog open={isDSTDialogOpen} onOpenChange={setIsDSTDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                disabled={selectedIds.size === 0}
                                className="font-medium gap-2 border-slate-200 hover:border-slate-900 transition-all opacity-100 disabled:opacity-50"
                            >
                                <Clock className="h-4 w-4" />
                                Daylight Saving Amendment
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
                            <div className="bg-primary p-8 text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
                                <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-inner border border-white/5">
                                    <Clock className="h-8 w-8 text-white" />
                                </div>
                                <DialogTitle className="text-xl font-black italic text-white uppercase tracking-tight relative z-10">DST Adjustment</DialogTitle>
                                <DialogDescription className="text-white/70 font-bold text-[10px] uppercase tracking-widest mt-2 relative z-10">
                                    Bulk Time Management
                                </DialogDescription>
                            </div>

                            <div className="p-6 bg-white space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="h-2 w-2 mt-2 rounded-full bg-primary shrink-0" />
                                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                            Choose the required adjustment for the <span className="text-primary font-bold">{selectedIds.size} selected</span> staff members.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <Button
                                        onClick={() => handleBulkDSTAdjustment(1)}
                                        className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 uppercase tracking-widest text-xs gap-3 group"
                                    >
                                        <div className="flex flex-col items-center">
                                            <span>Forward By 1 Hour</span>
                                            <span className="text-[9px] opacity-70 font-bold tracking-normal italic mt-0.5 group-hover:opacity-100 transition-opacity">(e.g. 09:00 → 10:00)</span>
                                        </div>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleBulkDSTAdjustment(-1)}
                                        className="w-full h-16 border-2 border-primary/20 hover:border-primary hover:bg-primary/5 text-primary font-black rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-xs gap-3 group"
                                    >
                                        <div className="flex flex-col items-center">
                                            <span>Back By 1 Hour</span>
                                            <span className="text-[9px] opacity-70 font-bold tracking-normal italic mt-0.5 group-hover:opacity-100 transition-opacity">(e.g. 09:00 → 08:00)</span>
                                        </div>
                                    </Button>
                                </div>

                                <p className="text-[9px] text-center text-muted-foreground font-bold uppercase tracking-tighter">
                                    This will update both Shift Start and End times
                                </p>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Bulk Reassign Requests */}
                    <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="font-medium gap-2 border-slate-200 hover:border-slate-900">
                                Reassign Requests
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Bulk Reassign Pending Requests</DialogTitle>
                                <DialogDescription>Transfer all pending leave and attendance requests from one manager to another — useful when a manager is on leave.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">From Manager</label>
                                    <Select value={reassignFromId} onValueChange={setReassignFromId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select manager going on leave..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {employees.filter(e => (e.roles || []).some((r: string) => r === 'MANAGER' || r === 'ADMIN')).map(m => (
                                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">To Manager</label>
                                    <Select value={reassignToId} onValueChange={setReassignToId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select substitute manager..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {employees.filter(e => (e.roles || []).some((r: string) => r === 'MANAGER' || r === 'ADMIN') && e.id !== reassignFromId).map(m => (
                                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <p className="text-xs text-muted-foreground">This only affects currently pending requests. Staff assignments are not changed — future requests still go to the original manager.</p>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsReassignOpen(false)}>Cancel</Button>
                                <Button
                                    disabled={!reassignFromId || !reassignToId || isReassigning}
                                    onClick={async () => {
                                        setIsReassigning(true)
                                        try {
                                            const res = await fetch('/api/admin/reassign-requests', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ fromManagerId: reassignFromId, toManagerId: reassignToId })
                                            })
                                            const data = await res.json()
                                            if (res.ok) {
                                                alert(`Reassigned ${data.reassigned.leaveRequests} leave requests and ${data.reassigned.attendanceRequests} attendance requests.`)
                                                setIsReassignOpen(false)
                                                setReassignFromId("")
                                                setReassignToId("")
                                            } else {
                                                alert(data.error || "Failed to reassign")
                                            }
                                        } finally {
                                            setIsReassigning(false)
                                        }
                                    }}
                                    className="bg-slate-800 hover:bg-slate-700 text-white"
                                >
                                    {isReassigning ? "Reassigning..." : "Confirm Reassign"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="font-medium gap-2">
                                <UserPlus className="h-4 w-4" /> Add New Staff
                            </Button>
                        </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Add New Staff</DialogTitle>
                            <DialogDescription>Add new staff member to the system</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddEmployee} className="space-y-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Legal Name</Label>
                                    <Input placeholder="Enter name" value={newName} onChange={e => setNewName(e.target.value)} required className="h-11" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Corporate Email Address</Label>
                                    <Input type="email" placeholder="email@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="h-11" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary Department</Label>
                                    <Select value={newDeptId} onValueChange={setNewDeptId} required>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Select Primary Department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map(d => (
                                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secondary Department(s)</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button type="button" className="h-11 w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                                <span className="text-muted-foreground truncate">
                                                    {newSecondaryDeptIds.length === 0
                                                        ? "None"
                                                        : newSecondaryDeptIds.length === 1
                                                            ? departments.find(d => d.id === newSecondaryDeptIds[0])?.name
                                                            : `${newSecondaryDeptIds.length} departments`}
                                                </span>
                                                <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-2" align="start">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-1 mb-1">Select Secondary Depts</p>
                                            {departments.filter(d => d.id !== newDeptId).map(d => (
                                                <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer" onClick={() => {
                                                    setNewSecondaryDeptIds(prev =>
                                                        prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id]
                                                    )
                                                }}>
                                                    <Checkbox checked={newSecondaryDeptIds.includes(d.id)} className="pointer-events-none" />
                                                    <span className="text-sm">{d.name}</span>
                                                </div>
                                            ))}
                                            {departments.filter(d => d.id !== newDeptId).length === 0 && (
                                                <p className="text-xs text-muted-foreground px-2 py-1">No other departments</p>
                                            )}
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location</Label>
                                    <Select value={newLocation} onValueChange={setNewLocation} required>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Select Location" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Philippines">Philippines</SelectItem>
                                            <SelectItem value="Australia">Australia</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assigned Manager</Label>
                                    <div onClickCapture={(e) => {
                                        if (!newDeptId) {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setShowDeptWarning(true)
                                        }
                                    }}>
                                        <Select value={newManagerId} onValueChange={setNewManagerId}>
                                            <SelectTrigger className="h-11">
                                                <SelectValue placeholder="Select Manager" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned" className="text-muted-foreground">No Manager</SelectItem>
                                                {employees.filter(e => e.roles?.includes('MANAGER') || e.roles?.includes('ADMIN') || e.role === 'MANAGER' || e.role === 'ADMIN').map(m => (
                                                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shift Start Time</Label>
                                    <Input
                                        type="time"
                                        value={newShiftStart}
                                        onChange={e => setNewShiftStart(e.target.value)}
                                        required
                                        className="h-11"
                                    />
                                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Standard start time for late calculations</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shift End Time</Label>
                                    <Input
                                        type="time"
                                        value={newShiftEnd}
                                        onChange={e => setNewShiftEnd(e.target.value)}
                                        required
                                        className="h-11"
                                    />
                                </div>

                                <div className="col-span-full bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-primary" />
                                        <span className="text-xs font-bold uppercase tracking-widest text-slate-700">Scheduling Intelligence</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Staff Local Time ({newLocation || 'Select Location'})</p>
                                            <div className="flex items-baseline gap-1.5">
                                                <p className="text-lg font-black text-slate-900 tracking-tight">{newShiftStart}</p>
                                                <span className="text-[10px] font-bold text-slate-400">TO</span>
                                                <p className="text-lg font-black text-slate-900 tracking-tight">{newShiftEnd}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1 md:border-l md:pl-6 border-slate-200">
                                            <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider">Your Display Equivalent</p>
                                            <div className="flex items-baseline gap-1.5">
                                                <p className="text-lg font-black text-primary tracking-tight">{formatShiftTime(newShiftStart, newLocation === 'Philippines' ? 'Asia/Manila' : newLocation === 'Australia' ? 'Australia/Sydney' : 'UTC')}</p>
                                                <span className="text-[10px] font-bold text-primary/30">TO</span>
                                                <p className="text-lg font-black text-primary tracking-tight">{formatShiftTime(newShiftEnd, newLocation === 'Philippines' ? 'Asia/Manila' : newLocation === 'Australia' ? 'Australia/Sydney' : 'UTC')}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground font-medium italic">
                                        * The system automatically handles Daylight Saving shifts based on the staff member's location.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Roles</Label>
                                    <div className="flex flex-wrap gap-2 p-2.5 bg-muted/30 rounded-lg border border-border min-h-11 items-center">
                                        {['USER', 'VIEWER', 'MANAGER', 'ADMIN'].map((role) => (
                                            <div key={role} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`new-role-${role}`}
                                                    checked={newRoles.includes(role)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setNewRoles([...newRoles, role])
                                                        } else {
                                                            setNewRoles(newRoles.filter(r => r !== role))
                                                        }
                                                    }}
                                                    className="rounded border-input text-primary focus:ring-primary"
                                                />
                                                <label htmlFor={`new-role-${role}`} className="text-xs font-bold text-foreground cursor-pointer select-none">
                                                    {role}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <Button type="submit" className="w-full h-11 font-bold uppercase tracking-widest text-xs">Create Staff Member</Button>
                        </form>
                    </DialogContent>

                    </Dialog>
                </div>
            </div>

            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardHeader className="border-b border-border p-6 space-y-4">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search staff..."
                                className="pl-9 h-10 w-full bg-white font-medium text-sm rounded-lg"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={deptFilter} onValueChange={setDeptFilter}>
                                <SelectTrigger className="h-10 w-[140px] bg-white text-xs font-bold uppercase tracking-widest border-border hover:bg-slate-50 transition-colors">
                                    <SelectValue placeholder="Dept" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Depts</SelectItem>
                                    {departments.map(d => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="h-10 w-[140px] bg-white text-xs font-bold uppercase tracking-widest border-border hover:bg-slate-50 transition-colors">
                                    <SelectValue placeholder="Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Roles</SelectItem>
                                    <SelectItem value="USER">User</SelectItem>
                                    <SelectItem value="VIEWER">Viewer</SelectItem>
                                    <SelectItem value="MANAGER">Manager</SelectItem>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="USER_ONLY">User Only</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={managerFilter} onValueChange={setManagerFilter}>
                                <SelectTrigger className="h-10 w-[140px] bg-white text-xs font-bold uppercase tracking-widest border-border hover:bg-slate-50 transition-colors">
                                    <SelectValue placeholder="Manager" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Managers</SelectItem>
                                    <SelectItem value="none">No Manager</SelectItem>
                                    {employees.filter(e => e.roles?.includes('MANAGER') || e.roles?.includes('ADMIN') || e.role === 'MANAGER' || e.role === 'ADMIN').map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="h-10 w-[140px] bg-white text-xs font-bold uppercase tracking-widest border-border hover:bg-slate-50 transition-colors italic">
                                    <SelectValue placeholder="Sort By" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name">Name</SelectItem>
                                    <SelectItem value="department">Dept</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button
                                variant={showArchived ? "default" : "outline"}
                                onClick={() => setShowArchived(!showArchived)}
                                className="h-10 text-[10px] font-black uppercase tracking-widest px-4 border-2 border-slate-900/10 hover:border-slate-900 transition-all rounded-lg"
                            >
                                {showArchived ? "Active Staff" : "Archived"}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                {selectedIds.size > 0 && (
                    <div className="bg-primary/5 border-b border-primary/10 p-4 flex items-center justify-between animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-primary">{selectedIds.size} selected</span>
                            <div className="h-4 w-px bg-primary/20" />
                            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-muted-foreground h-8">
                                Clear Selection
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleBulkArchive(!showArchived)}
                                disabled={isBulkProcessing}
                                className="h-8 gap-2 bg-white"
                            >
                                {isBulkProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                                {showArchived ? "Unarchive Selected" : "Archive Selected"}
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={handleBulkDelete}
                                disabled={isBulkProcessing}
                                className="h-8 gap-2"
                            >
                                {isBulkProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                Delete Selected
                            </Button>
                        </div>
                    </div>
                )}
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="w-[50px] pl-6">
                                    <Checkbox
                                        checked={filteredEmployees.length > 0 && selectedIds.size === filteredEmployees.length}
                                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                    />
                                </TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Staff Identity</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Department</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Work Hours</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Employment Location</TableHead>

                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Roles</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Assigned Manager</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredEmployees.map((emp) => (
                                <TableRow key={emp.id} className={selectedIds.has(emp.id) ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : "border-border hover:bg-muted/30 transition-colors group"}>
                                    <TableCell className="pl-6">
                                        <Checkbox
                                            checked={selectedIds.has(emp.id)}
                                            onCheckedChange={(checked) => handleSelectOne(emp.id, !!checked)}
                                        />
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-medium relative overflow-hidden text-sm">
                                                    <UserAvatar src={emp.image} name={emp.name} className="h-full w-full" />
                                                </div>
                                                {/* Status Indicator */}
                                                {emp.availabilityStatus && statusConfig[emp.availabilityStatus as keyof typeof statusConfig] && (() => {
                                                    const StatusIcon = statusConfig[emp.availabilityStatus as keyof typeof statusConfig].icon
                                                    const statusColor = statusConfig[emp.availabilityStatus as keyof typeof statusConfig].color
                                                    return (
                                                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100 z-10" title={statusConfig[emp.availabilityStatus as keyof typeof statusConfig].label}>
                                                            <StatusIcon className={`h-3 w-3 ${statusColor}`} />
                                                        </div>
                                                    )
                                                })()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground text-sm flex items-center gap-2">
                                                    {emp.name || "Unknown Identity"}
                                                    {emp.availabilityStatus && (
                                                        <span className="text-[10px] text-muted-foreground/60 font-medium px-1.5 py-0.5 bg-slate-100 rounded-full">
                                                            {statusConfig[emp.availabilityStatus as keyof typeof statusConfig]?.label || 'Available'}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Mail className="h-3 w-3 opacity-70" />
                                                    {emp.email}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className="font-normal text-xs bg-muted/50 text-muted-foreground border-border w-fit">
                                                <Building className="h-3 w-3 mr-1.5 opacity-70" />
                                                {emp.department?.name || 'Unassigned'}
                                            </Badge>
                                            {(emp.secondaryDepartments || []).map((d: any) => (
                                                <Badge key={d.id} variant="outline" className="font-normal text-[10px] bg-blue-50/50 text-blue-600 border-blue-200 w-fit">
                                                    <Building className="h-2.5 w-2.5 mr-1 opacity-70" />
                                                    {d.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <Badge variant="outline" className="font-mono text-xs bg-white text-slate-600 border-slate-200">
                                            <Clock className="h-3 w-3 mr-1.5 opacity-70" />
                                            {formatShiftTime(emp.shiftStartTime || "09:00", emp.selectedTimezone)} - {formatShiftTime(emp.shiftEndTime || "17:00", emp.selectedTimezone)}
                                            {effectiveTimezone !== (emp.selectedTimezone || 'Asia/Manila') && (
                                                <span className="ml-1 opacity-40 text-[9px] font-bold">LCL</span>
                                            )}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <MapPin className="h-3.5 w-3.5" />
                                            {emp.employmentLocation || 'N/A'}
                                        </div>
                                    </TableCell>

                                    <TableCell className="py-4 px-6">
                                        <div className="flex flex-wrap gap-1">
                                            {(emp.roles || [emp.role]).map((role: string) => (
                                                <Badge
                                                    key={role}
                                                    variant="secondary"
                                                    className={`text-xs font-medium border-transparent ${role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                                                        role === 'MANAGER' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}
                                                >
                                                    {role}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <User className="h-3.5 w-3.5" />
                                            {emp.manager?.name || 'No Manager'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 px-6 text-right">
                                        <div className="flex justify-end gap-1">
                                            {showArchived ? (
                                                <>
                                                    <Button
                                                        onClick={() => handleArchiveEmployee(emp.id, false)}
                                                        disabled={processingId === emp.id}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        title="Unarchive"
                                                    >
                                                        {processingId === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleDeleteEmployee(emp.id)}
                                                        disabled={processingId === emp.id}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        title="Delete Permanently"
                                                    >
                                                        {processingId === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                    </Button>
                                                </>

                                            ) : (
                                                <>
                                                    <Button
                                                        onClick={() => handleEditClick(emp)}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleArchiveEmployee(emp.id, true)}
                                                        disabled={processingId === emp.id}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                        title="Archive"
                                                    >
                                                        {processingId === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleForceLogout(emp.id, emp.name)}
                                                        disabled={processingId === emp.id}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                        title="Force Sign Out"
                                                    >
                                                        <LogOut className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleDeleteEmployee(emp.id)}
                                                        disabled={processingId === emp.id}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        title="Delete Permanently"
                                                    >
                                                        {processingId === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <User className="h-8 w-8 opacity-50" />
                                            <p className="text-sm">No {showArchived ? 'archived' : 'active'} staff members found matching your search</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Employee Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Staff Member</DialogTitle>
                        <DialogDescription>Update staff member details and permissions</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateEmployee} className="space-y-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Legal Name</Label>
                                <Input
                                    placeholder="Name"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Corporate Email</Label>
                                <Input
                                    type="email"
                                    placeholder="Email"
                                    value={editEmail}
                                    onChange={e => setEditEmail(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary Department</Label>
                                <Select value={editDeptId} onValueChange={val => {
                                    setEditDeptId(val)
                                    // Remove the newly selected primary from secondary if present
                                    setEditSecondaryDeptIds(prev => prev.filter(id => id !== val))
                                }}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select Primary Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned" className="text-muted-foreground">Unassigned</SelectItem>
                                        {departments.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secondary Department(s)</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button type="button" className="h-11 w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                            <span className="text-muted-foreground truncate">
                                                {editSecondaryDeptIds.length === 0
                                                    ? "None"
                                                    : editSecondaryDeptIds.length === 1
                                                        ? departments.find(d => d.id === editSecondaryDeptIds[0])?.name
                                                        : `${editSecondaryDeptIds.length} departments`}
                                            </span>
                                            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2" align="start">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-1 mb-1">Select Secondary Depts</p>
                                        {departments.filter(d => d.id !== editDeptId).map(d => (
                                            <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer" onClick={() => {
                                                setEditSecondaryDeptIds(prev =>
                                                    prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id]
                                                )
                                            }}>
                                                <Checkbox checked={editSecondaryDeptIds.includes(d.id)} className="pointer-events-none" />
                                                <span className="text-sm">{d.name}</span>
                                            </div>
                                        ))}
                                        {departments.filter(d => d.id !== editDeptId).length === 0 && (
                                            <p className="text-xs text-muted-foreground px-2 py-1">No other departments</p>
                                        )}
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location</Label>
                                <Select value={editLocation} onValueChange={setEditLocation}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select Location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Philippines">Philippines</SelectItem>
                                        <SelectItem value="Australia">Australia</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shift Start Time</Label>
                                <Input
                                    type="time"
                                    value={editShiftStart}
                                    onChange={e => setEditShiftStart(e.target.value)}
                                    required
                                    className="h-11"
                                />
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Standard start time for late calculations</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shift End Time</Label>
                                <Input
                                    type="time"
                                    value={editShiftEnd}
                                    onChange={e => setEditShiftEnd(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Working Days</Label>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Notifications are only sent on the staff member&apos;s working days</p>
                                <div className="flex gap-1.5 flex-wrap">
                                    {ALL_DAYS.map(day => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleEditWorkingDay(day)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                                                editWorkingDays.includes(day)
                                                    ? "bg-[#8B2323] text-white border-[#8B2323]"
                                                    : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                                            }`}
                                        >
                                            {DAY_LABELS[day]}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-1">
                                    <button type="button" onClick={() => setEditWorkingDays(["MON","TUE","WED","THU","FRI"])} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#8B2323] transition-colors">Mon–Fri</button>
                                    <span className="text-slate-300 text-[10px]">·</span>
                                    <button type="button" onClick={() => setEditWorkingDays(["MON","TUE","WED","THU"])} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#8B2323] transition-colors">Mon–Thu</button>
                                    <span className="text-slate-300 text-[10px]">·</span>
                                    <button type="button" onClick={() => setEditWorkingDays(["MON","TUE","WED","THU","FRI","SAT"])} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#8B2323] transition-colors">Mon–Sat</button>
                                </div>
                            </div>

                            <div className="col-span-full bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3 mt-2">
                                <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-primary" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-700">Scheduling Intelligence</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Staff Local Time ({editLocation || 'Select Location'})</p>
                                        <div className="flex items-baseline gap-1.5">
                                            <p className="text-lg font-black text-slate-900 tracking-tight">{editShiftStart}</p>
                                            <span className="text-[10px] font-bold text-slate-400">TO</span>
                                            <p className="text-lg font-black text-slate-900 tracking-tight">{editShiftEnd}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1 md:border-l md:pl-6 border-slate-200">
                                        <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider">Your Display Equivalent</p>
                                        <div className="flex items-baseline gap-1.5">
                                            <p className="text-lg font-black text-primary tracking-tight">{formatShiftTime(editShiftStart, editLocation === 'Philippines' ? 'Asia/Manila' : editLocation === 'Australia' ? 'Australia/Sydney' : 'UTC')}</p>
                                            <span className="text-[10px] font-bold text-primary/30">TO</span>
                                            <p className="text-lg font-black text-primary tracking-tight">{formatShiftTime(editShiftEnd, editLocation === 'Philippines' ? 'Asia/Manila' : editLocation === 'Australia' ? 'Australia/Sydney' : 'UTC')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assigned Manager</Label>
                                <Select
                                    value={editManagerId}
                                    onValueChange={setEditManagerId}
                                    open={isManagerSelectOpen}
                                    onOpenChange={(open) => {
                                        if (open) {
                                            if (!editDeptId || editDeptId === "unassigned") {
                                                setShowDeptWarning(true)
                                                setIsManagerSelectOpen(false)
                                            } else {
                                                setIsManagerSelectOpen(true)
                                            }
                                        } else {
                                            setIsManagerSelectOpen(false)
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select Manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned" className="text-muted-foreground">No Manager</SelectItem>
                                        {employees.filter(e => (e.roles?.includes('MANAGER') || e.roles?.includes('ADMIN') || e.role === 'MANAGER' || e.role === 'ADMIN') && e.id !== editingEmp?.id).map(m => (
                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Roles</Label>
                                <div className="flex flex-wrap gap-2 p-2.5 bg-muted/30 rounded-lg border border-border min-h-11 items-center">
                                    {['USER', 'VIEWER', 'MANAGER', 'ADMIN'].map((role) => (
                                        <div key={role} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`edit-role-${role}`}
                                                checked={editRoles.includes(role)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setEditRoles([...editRoles, role])
                                                    } else {
                                                        setEditRoles(editRoles.filter(r => r !== role))
                                                    }
                                                }}
                                                className="rounded border-input text-primary focus:ring-primary"
                                            />
                                            <label htmlFor={`edit-role-${role}`} className="text-xs font-bold text-foreground cursor-pointer select-none">
                                                {role}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <Button type="submit" disabled={isSaving} className="w-full h-11 font-bold uppercase tracking-widest text-xs gap-2">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            Save Staff Changes
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
            {/* Department Warning Dialog */}
            <Dialog open={showDeptWarning} onOpenChange={setShowDeptWarning}>
                <DialogContent className="max-w-md rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-primary p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
                        <ShieldCheck className="h-12 w-12 text-white/30 mx-auto mb-4" />
                        <DialogTitle className="text-xl font-black italic text-white uppercase tracking-tight relative z-10">Department Required</DialogTitle>
                        <DialogDescription className="text-white/70 font-bold text-[10px] uppercase tracking-widest mt-2 relative z-10">
                            Prerequisite Missing
                        </DialogDescription>
                    </div>

                    <div className="p-8 bg-white space-y-6">
                        <div className="text-center space-y-2">
                            <p className="text-slate-700 font-bold text-sm">
                                You must assign a department to this staff member before you can assign a reporting manager.
                            </p>
                            <p className="text-xs text-muted-foreground font-medium">
                                Managers are department-specific. Please select a department first to ensure the correct managerial hierarchy.
                            </p>
                        </div>
                        <Button onClick={() => setShowDeptWarning(false)} className="w-full">
                            Understood
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* General Confirmation Dialog */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            {confirmConfig?.variant === 'destructive' && <AlertTriangle className="h-5 w-5 text-destructive" />}
                            <DialogTitle>{confirmConfig?.title}</DialogTitle>
                        </div>
                        <DialogDescription>
                            {confirmConfig?.description}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmOpen(false)}
                            disabled={isConfirming}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant={confirmConfig?.variant === 'destructive' ? 'destructive' : 'default'}
                            onClick={executeConfirm}
                            disabled={isConfirming}
                            className="gap-2"
                        >
                            {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
