"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Pencil, Trash2, Plus, Building2 } from "lucide-react"

interface Department {
    id: string
    name: string
    _count?: {
        users: number
    }
}

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([])
    const [loading, setLoading] = useState(true)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
    const [departmentName, setDepartmentName] = useState("")

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
        } finally {
            setLoading(false)
        }
    }

    const handleAdd = async () => {
        if (!departmentName.trim()) {
            alert('Please enter a department name')
            return
        }

        try {
            const res = await fetch('/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: departmentName })
            })

            const data = await res.json()

            if (res.ok) {
                await fetchDepartments()
                setIsAddDialogOpen(false)
                setDepartmentName("")
            } else {
                alert(data.error || 'Failed to add department')
            }
        } catch (error) {
            console.error('Error adding department:', error)
            alert('Failed to add department. Please try again.')
        }
    }

    const handleEdit = async () => {
        if (!selectedDepartment || !departmentName.trim()) return

        try {
            const res = await fetch('/api/departments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedDepartment.id, name: departmentName })
            })

            if (res.ok) {
                await fetchDepartments()
                setIsEditDialogOpen(false)
                setDepartmentName("")
                setSelectedDepartment(null)
            }
        } catch (error) {
            console.error('Error updating department:', error)
            alert('Failed to update department')
        }
    }

    const handleDelete = async () => {
        if (!selectedDepartment) return

        try {
            const res = await fetch(`/api/departments?id=${selectedDepartment.id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                await fetchDepartments()
                setIsDeleteDialogOpen(false)
                setSelectedDepartment(null)
            }
        } catch (error) {
            console.error('Error deleting department:', error)
            alert('Failed to delete department')
        }
    }

    const openEditDialog = (department: Department) => {
        setSelectedDepartment(department)
        setDepartmentName(department.name)
        setIsEditDialogOpen(true)
    }

    const openDeleteDialog = (department: Department) => {
        setSelectedDepartment(department)
        setIsDeleteDialogOpen(true)
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Department Management</h1>
                <p className="text-muted-foreground">Manage departments and view staff allocation.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Departments</CardTitle>
                        <Button onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Department
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-center py-8 text-muted-foreground">Loading...</p>
                    ) : (
                        <div className="space-y-3">
                            {departments.map((department) => (
                                <div
                                    key={department.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                            <Building2 className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{department.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {department._count?.users || 0} staff members
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditDialog(department)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openDeleteDialog(department)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Department Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Department</DialogTitle>
                        <DialogDescription>Enter the department name below.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Department Name</Label>
                            <Input
                                id="name"
                                value={departmentName}
                                onChange={(e) => setDepartmentName(e.target.value)}
                                placeholder="e.g., Engineering"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setDepartmentName(""); }}>
                            Cancel
                        </Button>
                        <Button onClick={handleAdd}>Add Department</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Department Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Department</DialogTitle>
                        <DialogDescription>Update the department name below.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Department Name</Label>
                            <Input
                                id="edit-name"
                                value={departmentName}
                                onChange={(e) => setDepartmentName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setDepartmentName(""); }}>
                            Cancel
                        </Button>
                        <Button onClick={handleEdit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Department</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete {selectedDepartment?.name}?
                            {selectedDepartment?._count?.users ? (
                                <span className="block mt-2 text-red-600 font-medium">
                                    Warning: This department has {selectedDepartment._count.users} staff members assigned.
                                </span>
                            ) : null}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
