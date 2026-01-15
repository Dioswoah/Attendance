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
    const [newRole, setNewRole] = useState("USER")
    const [newManagerId, setNewManagerId] = useState("")
    const [isAddOpen, setIsAddOpen] = useState(false)

    // Edit state
    const [editingEmp, setEditingEmp] = useState<any>(null)
    const [editName, setEditName] = useState("")
    const [editEmail, setEditEmail] = useState("")
    const [editDeptId, setEditDeptId] = useState("")
    const [editRole, setEditRole] = useState("")
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
                    role: newRole,
                    managerId: newRole === "USER" && newManagerId ? newManagerId : null
                })
            })
            if (res.ok) {
                setIsAddOpen(false)
                setNewName("")
                setNewEmail("")
                setNewDeptId("")
                setNewRole("USER")
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
        setEditRole(emp.role || "USER")
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
                    role: editRole,
                    managerId: editRole === "USER" && editManagerId && editManagerId !== "unassigned" ? editManagerId : null
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
                <div className="h-12 w-12 rounded-xl bg-red-600 flex items-center justify-center animate-pulse shadow-lg">
                    <Flame className="h-6 w-6 text-white fill-white" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Personnel...</p>
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase leading-none">Personnel</h1>
                    <p className="text-red-600 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">Staff Directory & Operational Clearance</p>
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-14 px-8 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95 italic uppercase tracking-widest gap-3">
                            <UserPlus className="h-5 w-5" /> Add New Staff
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[450px] border-none rounded-[2.5rem] p-0 overflow-hidden shadow-2xl">
                        <div className="bg-red-600 p-8 text-white relative">
                            <DialogHeader className="space-y-1 relative z-10">
                                <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase leading-none">Add New Staff</DialogTitle>
                                <DialogDescription className="text-red-100 font-bold uppercase tracking-widest text-[9px]">
                                    Log new personnel into the central node
                                </DialogDescription>
                            </DialogHeader>
                        </div>
                        <form onSubmit={handleAddEmployee} className="p-8 space-y-6 bg-white">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Legal Name</Label>
                                    <Input placeholder="Enter name..." className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" value={newName} onChange={e => setNewName(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Corporate Email Address</Label>
                                    <Input type="email" placeholder="Email@redadair.com..." className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Department</Label>
                                    <Select value={newDeptId} onValueChange={setNewDeptId} required>
                                        <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-500">
                                            <SelectValue placeholder="SELECT DEPARTMENT..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                            {departments.map(d => (
                                                <SelectItem key={d.id} value={d.id} className="font-bold uppercase italic text-[9px] tracking-widest">{d.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Role</Label>
                                    <Select value={newRole} onValueChange={setNewRole} required>
                                        <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-500">
                                            <SelectValue placeholder="SELECT ROLE..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                            <SelectItem value="USER" className="font-bold uppercase italic text-[9px] tracking-widest">User</SelectItem>
                                            <SelectItem value="MANAGER" className="font-bold uppercase italic text-[9px] tracking-widest">Manager</SelectItem>
                                            <SelectItem value="ADMIN" className="font-bold uppercase italic text-[9px] tracking-widest">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {newRole === "USER" && (
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Assigned Manager</Label>
                                        <Select value={newManagerId} onValueChange={setNewManagerId}>
                                            <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-500">
                                                <SelectValue placeholder="SELECT MANAGER..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                                <SelectItem value="unassigned" className="font-bold text-[9px] uppercase italic text-slate-400">No Manager</SelectItem>
                                                {employees.filter(e => e.role === 'MANAGER' || e.role === 'ADMIN').map(m => (
                                                    <SelectItem key={m.id} value={m.id} className="font-bold uppercase italic text-[9px] tracking-widest">{m.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <Button type="submit" className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 italic uppercase tracking-widest">Create Staff Member</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white border border-slate-50">
                <CardHeader className="bg-white p-6 border-b border-slate-50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        <Input
                            placeholder="SEARCH BY IDENTITY OR NODE..."
                            className="pl-12 h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic transition-all focus:bg-white"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="border-slate-100 hover:bg-transparent">
                                <TableHead className="py-5 px-8 font-black text-slate-400 uppercase text-[9px] tracking-widest text-left">Personnel Identity</TableHead>
                                <TableHead className="py-5 px-8 font-black text-slate-400 uppercase text-[9px] tracking-widest text-left">Department</TableHead>
                                <TableHead className="py-5 px-8 font-black text-slate-400 uppercase text-[9px] tracking-widest text-left">Email</TableHead>
                                <TableHead className="py-5 px-8 font-black text-slate-400 uppercase text-[9px] tracking-widest text-left">Role</TableHead>
                                <TableHead className="py-5 px-8 font-black text-slate-400 uppercase text-[9px] tracking-widest text-left">Assigned Manager</TableHead>
                                <TableHead className="py-5 px-8 font-black text-slate-400 uppercase text-[9px] tracking-widest text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredEmployees.map((emp) => (
                                <TableRow key={emp.id} className="border-slate-50 hover:bg-slate-50/20 transition-all duration-200 group">
                                    <TableCell className="py-5 px-8">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-black italic relative overflow-hidden text-sm">
                                                {emp.image ? <img src={emp.image} alt="" className="h-full w-full object-cover" /> : emp.name?.charAt(0) || "U"}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 uppercase italic text-[11px] leading-tight">{emp.name || "Unknown Identity"}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-5 px-8">
                                        <Badge variant="outline" className="bg-red-50/50 text-red-600 text-[8px] font-black uppercase tracking-widest border-none px-3 py-1.5 rounded-lg italic">
                                            <Building className="h-2.5 w-2.5 mr-1.5 opacity-50" />
                                            {emp.department?.name || 'Unassigned'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-5 px-8">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 italic lowercase tracking-tight">
                                            <Mail className="h-3 w-3 text-slate-300" />
                                            {emp.email}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-5 px-8">
                                        <Badge
                                            variant="outline"
                                            className={`text-[8px] font-black uppercase tracking-widest border-none px-3 py-1.5 rounded-lg italic ${emp.role === 'ADMIN' ? 'bg-red-50 text-red-600' :
                                                emp.role === 'MANAGER' ? 'bg-blue-50 text-blue-600' :
                                                    'bg-slate-50 text-slate-600'
                                                }`}
                                        >
                                            {emp.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-5 px-8">
                                        {emp.role === 'USER' ? (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 italic tracking-tight">
                                                <User className="h-3 w-3 text-slate-300" />
                                                {emp.manager?.name || 'No Manager'}
                                            </div>
                                        ) : (
                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">N/A</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-5 px-8 text-right">
                                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                            <Button
                                                onClick={() => handleEditClick(emp)}
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl"
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                onClick={() => handleDeleteEmployee(emp.id)}
                                                disabled={processingId === emp.id}
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl"
                                            >
                                                {processingId === emp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-24">
                                        <div className="flex flex-col items-center gap-2 opacity-20">
                                            <User className="h-8 w-8 text-slate-900" />
                                            <p className="text-[9px] font-black uppercase tracking-widest italic leading-tight">No identities detected in current parameters</p>
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
                <DialogContent className="sm:max-w-[450px] border-none rounded-[2.5rem] p-0 overflow-hidden shadow-2xl">
                    <div className="bg-red-600 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 h-32 w-32 bg-white/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
                        <DialogHeader className="space-y-1 relative z-10">
                            <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase leading-none">Edit Staff Member</DialogTitle>
                            <DialogDescription className="text-red-100 font-bold uppercase tracking-widest text-[9px]">Updating authorized personnel metrics</DialogDescription>
                        </DialogHeader>
                    </div>
                    <form onSubmit={handleUpdateEmployee} className="p-8 space-y-6 bg-white">
                        <div className="grid grid-cols-1 gap-5">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Legal Name</Label>
                                <Input
                                    placeholder="Name"
                                    className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Corporate Email</Label>
                                <Input
                                    type="email"
                                    placeholder="Email"
                                    className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic"
                                    value={editEmail}
                                    onChange={e => setEditEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Department</Label>
                                <Select value={editDeptId} onValueChange={setEditDeptId}>
                                    <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-500">
                                        <SelectValue placeholder="Select Department" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                        <SelectItem value="unassigned" className="font-bold text-[9px] uppercase italic text-slate-400">Unassigned</SelectItem>
                                        {departments.map(d => (
                                            <SelectItem key={d.id} value={d.id} className="font-bold uppercase italic text-[9px] tracking-widest">{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Role</Label>
                                <Select value={editRole} onValueChange={setEditRole}>
                                    <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-500">
                                        <SelectValue placeholder="Select Role" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                        <SelectItem value="USER" className="font-bold uppercase italic text-[9px] tracking-widest">User</SelectItem>
                                        <SelectItem value="MANAGER" className="font-bold uppercase italic text-[9px] tracking-widest">Manager</SelectItem>
                                        <SelectItem value="ADMIN" className="font-bold uppercase italic text-[9px] tracking-widest">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {editRole === "USER" && (
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Assigned Manager</Label>
                                    <Select value={editManagerId} onValueChange={setEditManagerId}>
                                        <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-500">
                                            <SelectValue placeholder="Select Manager" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                            <SelectItem value="unassigned" className="font-bold text-[9px] uppercase italic text-slate-400">No Manager</SelectItem>
                                            {employees.filter(e => (e.role === 'MANAGER' || e.role === 'ADMIN') && e.id !== editingEmp?.id).map(m => (
                                                <SelectItem key={m.id} value={m.id} className="font-bold uppercase italic text-[9px] tracking-widest">{m.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 italic uppercase tracking-widest flex gap-3"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <ShieldCheck className="h-4 w-4 text-white" />}
                            Save Changes
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
