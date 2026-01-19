"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Mail, User, Building, Trash2, Edit2, Loader2, ShieldCheck, MailIcon, Flame, UserPlus } from "lucide-react"

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
            console.error("Failed to fetch employees")
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
            console.error("Failed to update employee")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteEmployee = async (id: string) => {
        if (!confirm("Are you sure you want to delete this employee? This action cannot be undone.")) return

        setProcessingId(id)
        try {
            const res = await fetch(`/api/employees/${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            console.error("Failed to delete employee")
        } finally {
            setProcessingId(null)
        }
    }

    const filteredEmployees = employees.filter(emp =>
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-vh-50 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Syncing Personnel...</p>
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Personnel</h1>
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
                            <DialogDescription>Log new personnel into the central node</DialogDescription>
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
                            <Button type="submit" className="w-full">Create Staff Member</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardHeader className="border-b border-border p-6">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by identity or node..."
                            className="pl-9 h-10 w-full"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Personnel Identity</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Department</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Email</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Roles</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Assigned Manager</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredEmployees.map((emp) => (
                                <TableRow key={emp.id} className="border-border hover:bg-muted/30 transition-colors group">
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
                                        <div className="flex justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                onClick={() => handleEditClick(emp)}
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                onClick={() => handleDeleteEmployee(emp.id)}
                                                disabled={processingId === emp.id}
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            >
                                                {processingId === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <User className="h-8 w-8 opacity-50" />
                                            <p className="text-sm">No identities detected matching your search</p>
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
                        <DialogDescription>Updating authorized personnel metrics</DialogDescription>
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
                            <Label>Assigned Manager</Label>
                            <Select value={editManagerId} onValueChange={setEditManagerId}>
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
                        <Button type="submit" disabled={isSaving} className="w-full gap-2">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            Save Changes
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
