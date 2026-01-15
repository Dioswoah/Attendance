"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Building2, Users, MoreVertical, Trash2, Search, ArrowRight, Loader2, UserMinus, ShieldCheck, LayoutGrid, Edit2, Flame } from "lucide-react"

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<any[]>([])
    const [employees, setEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [newDeptName, setNewDeptName] = useState("")
    const [isAddOpen, setIsAddOpen] = useState(false)

    // Edit State
    const [editingDept, setEditingDept] = useState<any>(null)
    const [editDeptName, setEditDeptName] = useState("")
    const [isEditOpen, setIsEditOpen] = useState(false)

    // View Staff State
    const [viewingDept, setViewingDept] = useState<any>(null)
    const [isViewOpen, setIsViewOpen] = useState(false)

    // Action States
    const [processingId, setProcessingId] = useState<string | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [deptRes, empRes] = await Promise.all([
                fetch('/api/departments'),
                fetch('/api/employees')
            ])
            if (deptRes.ok && empRes.ok) {
                setDepartments(await deptRes.json())
                setEmployees(await empRes.json())
            }
        } catch (error) {
            console.error("Failed to fetch departments")
        } finally {
            setLoading(false)
        }
    }

    const handleAddDept = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch('/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newDeptName })
            })
            if (res.ok) {
                setIsAddOpen(false)
                setNewDeptName("")
                fetchData()
            }
        } catch (error) {
            console.error("Failed to add department")
        }
    }

    const handleEditClick = (dept: any) => {
        setEditingDept(dept)
        setEditDeptName(dept.name)
        setIsEditOpen(true)
    }

    const handleUpdateDept = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingDept) return
        setProcessingId(editingDept.id)
        try {
            const res = await fetch(`/api/departments/${editingDept.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editDeptName })
            })
            if (res.ok) {
                setIsEditOpen(false)
                fetchData()
            }
        } catch (error) {
            console.error("Failed to update department")
        } finally {
            setProcessingId(null)
        }
    }

    const handleDeleteDept = async (id: string) => {
        if (!confirm("Are you sure you want to delete this department? Employees will be unassigned.")) return

        setProcessingId(id)
        try {
            const res = await fetch(`/api/departments/${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            console.error("Failed to delete department")
        } finally {
            setProcessingId(null)
        }
    }

    const handleUnassignStaff = async (empId: string) => {
        if (!confirm("Are you sure you want to remove this staff from the department?")) return

        setProcessingId(empId)
        try {
            const res = await fetch(`/api/employees/${empId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ departmentId: null })
            })
            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            console.error("Failed to unassign staff")
        } finally {
            setProcessingId(null)
        }
    }

    const handleViewStaff = (dept: any) => {
        setViewingDept(dept)
        setIsViewOpen(true)
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="h-10 w-10 rounded-xl bg-red-600 flex items-center justify-center animate-pulse shadow-lg">
                    <Flame className="h-5 w-5 text-white fill-white" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Node Architecture...</p>
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase leading-none">Departments</h1>
                    <p className="text-red-600 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">Structural Node Configuration & Hierarchies</p>
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-14 px-8 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95 italic uppercase tracking-widest gap-3">
                            <Plus className="h-5 w-5" /> Add New Department
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[450px] border-none rounded-[2.5rem] p-0 overflow-hidden shadow-2xl">
                        <div className="bg-slate-900 p-8 text-white relative">
                            <DialogHeader className="space-y-1 relative z-10">
                                <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase leading-none">Add New Department</DialogTitle>
                                <DialogDescription className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Defining a company division architecture</DialogDescription>
                            </DialogHeader>
                        </div>
                        <form onSubmit={handleAddDept} className="p-8 space-y-6 bg-white">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Department Identifier</Label>
                                <Input
                                    placeholder="NODE NAME (E.G. OPERATIONS)..."
                                    className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic"
                                    value={newDeptName}
                                    onChange={e => setNewDeptName(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 italic uppercase tracking-widest">Create Department</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {departments.map((dept) => {
                    const deptEmployees = employees.filter(e => e.departmentId === dept.id)
                    return (
                        <Card key={dept.id} className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white border border-slate-100 group hover:shadow-md transition-all duration-300">
                            <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
                                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-red-600 border border-slate-100 shadow-sm transition-transform group-hover:scale-110">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div className="flex gap-1.5">
                                    <Button
                                        onClick={() => handleEditClick(dept)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        onClick={() => handleDeleteDept(dept.id)}
                                        disabled={processingId === dept.id}
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        {processingId === dept.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-1.5">{dept.name}</h3>
                                <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                                    <Users className="h-3 w-3 text-red-600/50" />
                                    <span>{deptEmployees.length} Authorized Staff</span>
                                </div>
                                <div className="mt-8 pt-6 border-t border-slate-50">
                                    <Button
                                        onClick={() => handleViewStaff(dept)}
                                        variant="ghost"
                                        className="p-0 h-auto text-slate-900 font-bold italic uppercase tracking-widest hover:text-red-600 hover:bg-transparent flex items-center gap-2 group/btn transition-colors"
                                    >
                                        <span className="text-[9px]">View Staff</span>
                                        <ArrowRight className="h-2.5 w-2.5 group-hover/btn:translate-x-1 transition-transform" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Edit Department Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[450px] border-none rounded-[2.5rem] p-0 overflow-hidden shadow-2xl">
                    <div className="bg-slate-900 p-8 text-white relative">
                        <DialogHeader className="space-y-1 relative z-10">
                            <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase leading-none">Edit Department</DialogTitle>
                            <DialogDescription className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Updating division structural identity</DialogDescription>
                        </DialogHeader>
                    </div>
                    <form onSubmit={handleUpdateDept} className="p-8 space-y-6 bg-white">
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Department Identifier</Label>
                            <Input
                                placeholder="ENTER NEW NAME..."
                                className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic"
                                value={editDeptName}
                                onChange={e => setEditDeptName(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={processingId === editingDept?.id} className="w-full h-14 bg-slate-900 hover:bg-black text-white font-black rounded-xl shadow-lg transition-all active:scale-95 italic uppercase tracking-widest flex gap-3">
                            {processingId === editingDept?.id && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* View Staff Dialog */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-[500px] border-none rounded-[2.5rem] p-0 overflow-hidden shadow-2xl">
                    <div className="bg-red-600 p-8 text-white relative">
                        <DialogHeader className="space-y-1 relative z-10">
                            <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase leading-none">{viewingDept?.name}</DialogTitle>
                            <DialogDescription className="text-red-100 font-bold uppercase tracking-widest text-[9px]">Active Department Staff</DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="p-8 max-h-[60vh] overflow-y-auto space-y-3 bg-white">
                        {employees.filter(e => e.departmentId === viewingDept?.id).length > 0 ? (
                            employees.filter(e => e.departmentId === viewingDept?.id).map((emp) => (
                                <div key={emp.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center overflow-hidden font-black text-slate-400 italic shadow-sm text-xs">
                                            {emp.image ? <img src={emp.image} alt="" className="h-full w-full object-cover" /> : emp.name.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-800 uppercase italic text-[11px] leading-tight">{emp.name}</span>
                                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{emp.email}</span>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => handleUnassignStaff(emp.id)}
                                        disabled={processingId === emp.id}
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-200 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        {processingId === emp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="py-16 text-center flex flex-col items-center gap-2 opacity-30">
                                <LayoutGrid className="h-8 w-8 text-slate-900" />
                                <p className="text-[9px] font-black uppercase tracking-widest italic leading-tight text-center">No operatives currently assigned</p>
                            </div>
                        )}
                    </div>
                    <div className="p-6 border-t border-slate-50 bg-slate-50/30 flex justify-end">
                        <Button onClick={() => setIsViewOpen(false)} className="h-10 px-6 rounded-lg bg-slate-900 hover:bg-black text-white font-black italic uppercase tracking-widest text-[9px]">
                            Exit Node
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
