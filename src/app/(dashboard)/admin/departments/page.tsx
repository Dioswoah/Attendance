"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Building2, Users, MoreVertical, Trash2, Search, ArrowRight, Loader2, UserMinus, ShieldCheck, LayoutGrid, Edit2, Flame } from "lucide-react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/UserAvatar"

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
            // Error handled
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
            // Error handled
        } finally {
            setProcessingId(null)
        }
    }

    const handleDeleteDept = (id: string) => {
        toast("Delete Department?", {
            description: "Are you sure you want to delete this department? Employees will be unassigned.",
            duration: Infinity,
            action: {
                label: "Delete",
                onClick: () => performDeleteDept(id)
            },
            cancel: {
                label: "Cancel",
                onClick: () => toast.dismiss()
            }
        })
    }

    const performDeleteDept = async (id: string) => {
        setProcessingId(id)
        try {
            const res = await fetch(`/api/departments/${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                toast.success("Department deleted")
                fetchData()
            } else {
                toast.error("Failed to delete department")
            }
        } catch (error) {
            toast.error("Error deleting department")
        } finally {
            setProcessingId(null)
        }
    }

    const handleUnassignStaff = (empId: string) => {
        toast("Unassign Staff?", {
            description: "Are you sure you want to remove this staff from the department?",
            duration: Infinity,
            action: {
                label: "Unassign",
                onClick: () => performUnassignStaff(empId)
            },
            cancel: {
                label: "Cancel",
                onClick: () => toast.dismiss()
            }
        })
    }

    const performUnassignStaff = async (empId: string) => {
        setProcessingId(empId)
        try {
            const res = await fetch(`/api/employees/${empId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ departmentId: null })
            })
            if (res.ok) {
                toast.success("Staff unassigned")
                fetchData()
            } else {
                toast.error("Failed to unassign staff")
            }
        } catch (error) {
            toast.error("Error unassigning staff")
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
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-sm overflow-hidden animate-bounce p-2">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Departments...</p>
            </div>
        )
    }

    return (
        <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-10 px-4 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Departments</h1>
                    <p className="text-muted-foreground text-sm">Structural Configuration & Hierarchies</p>
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="font-medium gap-2">
                            <Plus className="h-4 w-4" /> Add New Department
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[450px]">
                        <DialogHeader>
                            <DialogTitle>Add New Department</DialogTitle>
                            <DialogDescription>Defining a company division architecture</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddDept} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Department Identifier</Label>
                                <Input
                                    placeholder="Enter department name..."
                                    value={newDeptName}
                                    onChange={e => setNewDeptName(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full">Create Department</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {departments.map((dept) => {
                    const deptEmployees = employees.filter(e => e.departmentId === dept.id)
                    return (
                        <Card key={dept.id} className="border border-border shadow-sm rounded-xl overflow-hidden bg-white hover:shadow-md transition-all duration-300">
                            <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-sm">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        onClick={() => handleEditClick(dept)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        onClick={() => handleDeleteDept(dept.id)}
                                        disabled={processingId === dept.id}
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    >
                                        {processingId === dept.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <h3 className="text-lg font-semibold text-foreground mb-1">{dept.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Users className="h-4 w-4 opacity-70" />
                                    <span>{deptEmployees.length} Authorized Staff</span>
                                </div>
                                <div className="mt-6 pt-4 border-t border-border">
                                    <Button
                                        onClick={() => handleViewStaff(dept)}
                                        variant="ghost"
                                        className="p-0 h-auto text-primary text-sm font-medium hover:text-primary/80 hover:bg-transparent flex items-center gap-1 group/btn"
                                    >
                                        View Staff
                                        <ArrowRight className="h-3 w-3 group-hover/btn:translate-x-1 transition-transform" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Edit Department Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Edit Department</DialogTitle>
                        <DialogDescription>Updating division structural identity</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateDept} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Department Identifier</Label>
                            <Input
                                placeholder="Enter department name..."
                                value={editDeptName}
                                onChange={e => setEditDeptName(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={processingId === editingDept?.id} className="w-full gap-2">
                            {processingId === editingDept?.id && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* View Staff Dialog */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{viewingDept?.name}</DialogTitle>
                        <DialogDescription>Active Department Staff</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto space-y-3 py-4">
                        {employees.filter(e => e.departmentId === viewingDept?.id).length > 0 ? (
                            employees.filter(e => e.departmentId === viewingDept?.id).map((emp) => (
                                <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden font-medium text-muted-foreground text-xs">
                                            <UserAvatar src={emp.image} name={emp.name} className="h-full w-full" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm text-foreground leading-none">{emp.name}</span>
                                            <span className="text-xs text-muted-foreground mt-1">{emp.email}</span>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => handleUnassignStaff(emp.id)}
                                        disabled={processingId === emp.id}
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    >
                                        {processingId === emp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center flex flex-col items-center gap-2 text-muted-foreground opacity-50">
                                <LayoutGrid className="h-8 w-8" />
                                <p className="text-sm font-medium">No operatives currently assigned</p>
                            </div>
                        )}
                    </div>
                    <div className="pt-4 border-t border-border flex justify-end">
                        <Button variant="outline" onClick={() => setIsViewOpen(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
