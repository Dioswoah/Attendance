"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Mail, User, Building, Trash2, Edit2, Loader2, ShieldCheck, MailIcon, Flame, UserPlus, Archive, ArchiveRestore } from "lucide-react"

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<any[]>([])
    const [departments, setDepartments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    // New employee state
    const [newName, setNewName] = useState("")
    const [newEmail, setNewEmail] = useState("")
    const [newDeptId, setNewDeptId] = useState("")
    const [newRoles, setNewRoles] = useState<string[]>(["USER"])
    const [newManagerId, setNewManagerId] = useState("")
    const [isAddOpen, setIsAddOpen] = useState(false)

    // Edit state
    const [editingEmp, setEditingEmp] = useState<any>(null)
    const [editName, setEditName] = useState("")
    const [editEmail, setEditEmail] = useState("")
    const [editDeptId, setEditDeptId] = useState("")
    const [editRoles, setEditRoles] = useState<string[]>([])
    const [editManagerId, setEditManagerId] = useState("")
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
        try {
            const res = await fetch('/api/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName,
                    email: newEmail,
                    departmentId: newDeptId,
                    roles: newRoles,
                    managerId: newManagerId || null
                })
            })
            if (res.ok) {
                setIsAddOpen(false)
                setNewName("")
                setNewEmail("")
                setNewDeptId("")
                setNewRoles(["USER"])
                setNewManagerId("")
                fetchData()
            }
        } catch (error) {
            console.error("Failed to add employee")
        }
    }

    const handleEditClick = (emp: any) => {
        setEditingEmp(emp)
        setEditName(emp.name || "")
        setEditEmail(emp.email || "")
        setEditDeptId(emp.departmentId || "")
        // Handle migration from single role to roles array if needed
        setEditRoles(emp.roles || (emp.role ? [emp.role] : ["USER"]))
        setEditManagerId(emp.managerId || "")
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
                    departmentId: editDeptId === "unassigned" ? null : editDeptId,
                    roles: editRoles,
                    managerId: editManagerId && editManagerId !== "unassigned" ? editManagerId : null
                })
            })
            if (res.ok) {
                setIsEditOpen(false)
                fetchData()
            }
        } catch (error) {
            // Error handled
        } finally {
            setIsSaving(false)
        }
    }

    const handleArchiveEmployee = async (id: string, archive: boolean) => {
        const action = archive ? "archive" : "unarchive"
        if (!confirm(`Are you sure you want to ${action} this staff member?`)) return

        setProcessingId(id)
        try {
            const res = await fetch(`/api/employees/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isArchived: archive })
            })
            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            // Error handled
        } finally {
            setProcessingId(null)
        }
    }

    const handleDeleteEmployee = async (id: string) => {
        if (!confirm("Are you sure you want to PERMANENTLY delete this staff member? This action cannot be undone.")) return

        setProcessingId(id)
        try {
            const res = await fetch(`/api/employees/${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            // Error handled
        } finally {
            setProcessingId(null)
        }
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

    const handleBulkArchive = async (archive: boolean) => {
        const action = archive ? "archive" : "unarchive"
        if (!confirm(`Are you sure you want to ${action} ${selectedIds.size} staff members?`)) return

        setIsBulkProcessing(true)
        try {
            await Promise.all(Array.from(selectedIds).map(id =>
                fetch(`/api/employees/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isArchived: archive })
                })
            ))
            setSelectedIds(new Set())
            fetchData()
        } catch (error) {
            console.error("Bulk action failed", error)
        } finally {
            setIsBulkProcessing(false)
        }
    }

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to PERMANENTLY delete ${selectedIds.size} staff members?`)) return

        setIsBulkProcessing(true)
        try {
            await Promise.all(Array.from(selectedIds).map(id =>
                fetch(`/api/employees/${id}`, { method: 'DELETE' })
            ))
            setSelectedIds(new Set())
            fetchData()
        } catch (error) {
            console.error("Bulk delete failed", error)
        } finally {
            setIsBulkProcessing(false)
        }
    }

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesArchive = showArchived ? emp.isArchived : !emp.isArchived
        const matchesDept = deptFilter === "all" || emp.departmentId === deptFilter
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
            <div className="flex flex-col items-center justify-center min-vh-50 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Syncing Staff...</p>
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Staff Management</h1>
                    <p className="text-muted-foreground text-sm">Staff Directory & Operational Clearance</p>
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="font-medium gap-2">
                            <UserPlus className="h-4 w-4" /> Add New Staff
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[450px]">
                        <DialogHeader>
                            <DialogTitle>Add New Staff</DialogTitle>
                            <DialogDescription>Add new staff member to the system</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddEmployee} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Full Legal Name</Label>
                                <Input placeholder="Enter name" value={newName} onChange={e => setNewName(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Corporate Email Address</Label>
                                <Input type="email" placeholder="email@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Department</Label>
                                <Select value={newDeptId} onValueChange={setNewDeptId} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Roles</Label>
                                <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-border">
                                    {['USER', 'MANAGER', 'ADMIN'].map((role) => (
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
                                            <label htmlFor={`new-role-${role}`} className="text-sm font-medium text-foreground cursor-pointer select-none">
                                                {role}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Assigned Manager</Label>
                                <div onClickCapture={(e) => {
                                    if (!newDeptId) {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setShowDeptWarning(true)
                                    }
                                }}>
                                    <Select value={newManagerId} onValueChange={setNewManagerId}>
                                        <SelectTrigger>
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
                            <Button type="submit" className="w-full">Create Staff Member</Button>
                        </form>
                    </DialogContent>
                </Dialog>
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
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Email</TableHead>
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
                                            <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-medium relative overflow-hidden text-sm">
                                                {emp.image ? <img src={emp.image} alt="" className="h-full w-full object-cover" /> : emp.name?.charAt(0) || "U"}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground text-sm">{emp.name || "Unknown Identity"}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <Badge variant="outline" className="font-normal text-xs bg-muted/50 text-muted-foreground border-border">
                                            <Building className="h-3 w-3 mr-1.5 opacity-70" />
                                            {emp.department?.name || 'Unassigned'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Mail className="h-3.5 w-3.5" />
                                            {emp.email}
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
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Edit Staff Member</DialogTitle>
                        <DialogDescription>Update staff member details and permissions</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateEmployee} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Full Legal Name</Label>
                            <Input
                                placeholder="Name"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Corporate Email</Label>
                            <Input
                                type="email"
                                placeholder="Email"
                                value={editEmail}
                                onChange={e => setEditEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Select value={editDeptId} onValueChange={setEditDeptId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Department" />
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
                            <Label>Roles</Label>
                            <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-border">
                                {['USER', 'MANAGER', 'ADMIN'].map((role) => (
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
                                        <label htmlFor={`edit-role-${role}`} className="text-sm font-medium text-foreground cursor-pointer select-none">
                                            {role}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="space-y-2">
                                <Label>Assigned Manager</Label>
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
                                    <SelectTrigger>
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
                        </div>
                        <Button type="submit" disabled={isSaving} className="w-full gap-2">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            Save Changes
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
                        <DialogFooter className="sm:justify-center">
                            <DialogClose asChild>
                                <Button className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg">
                                    Okay, I'll Assign a Department
                                </Button>
                            </DialogClose>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
