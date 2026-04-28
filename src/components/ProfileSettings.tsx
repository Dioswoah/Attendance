"use client"

import { useState, useEffect } from "react"
import { User, Edit, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function ProfileSettings() {
    const [open, setOpen] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [managers, setManagers] = useState<any[]>([])
    const [shiftStart, setShiftStart] = useState("")
    const [shiftEnd, setShiftEnd] = useState("")
    const [managerId, setManagerId] = useState("")
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) return
        const load = async () => {
            try {
                const [profileRes, managersRes] = await Promise.all([
                    fetch('/api/user/me'),
                    fetch('/api/managers'),
                ])
                if (profileRes.ok) {
                    const data = await profileRes.json()
                    setProfile(data)
                    setShiftStart(data.shiftStartTime || "09:00")
                    setShiftEnd(data.shiftEndTime || "17:00")
                    setManagerId(data.managerId || "unassigned")
                }
                if (managersRes.ok) {
                    setManagers(await managersRes.json())
                }
            } catch {
                toast.error("Failed to load profile")
            }
        }
        load()
    }, [open])

    const handleSave = async () => {
        if (!shiftStart || !shiftEnd) {
            toast.error("Please set both shift times")
            return
        }
        setSaving(true)
        try {
            const res = await fetch('/api/user/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftStartTime: shiftStart,
                    shiftEndTime: shiftEnd,
                    managerId: managerId || "unassigned",
                }),
            })
            if (res.ok) {
                setProfile(await res.json())
                toast.success("Profile updated")
                setOpen(false)
            } else {
                toast.error("Failed to save changes")
            }
        } catch {
            toast.error("Failed to save changes")
        } finally {
            setSaving(false)
        }
    }

    const secondaryDepts: any[] = profile?.secondaryDepartments ?? []
    const secondaryLabel =
        secondaryDepts.length === 0
            ? "None"
            : secondaryDepts.map((d: any) => d.name).join(", ")

    return (
        <>
            <button
                className="flex items-center w-full px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-all cursor-pointer group mb-1"
                onClick={() => setOpen(true)}
            >
                <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0 group-hover:bg-purple-100 transition-colors">
                    <User className="w-4 h-4" />
                </div>
                <div className="flex-1 ml-3 flex flex-col items-start">
                    <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-slate-700">My Profile</span>
                        <Edit className="w-3 h-3 text-slate-300 group-hover:text-purple-500 transition-colors" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">View and edit your details</p>
                </div>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>My Profile</DialogTitle>
                        <DialogDescription>View your details. You can update your shift times and assigned manager.</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
                        {/* Read-only: Name */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                            <Input value={profile?.name ?? ""} readOnly disabled className="h-11 bg-muted/40 cursor-not-allowed" />
                        </div>

                        {/* Read-only: Email */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Corporate Email</Label>
                            <Input value={profile?.email ?? ""} readOnly disabled className="h-11 bg-muted/40 cursor-not-allowed" />
                        </div>

                        {/* Read-only: Primary Department */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary Department</Label>
                            <Input value={profile?.department?.name ?? "Unassigned"} readOnly disabled className="h-11 bg-muted/40 cursor-not-allowed" />
                        </div>

                        {/* Read-only: Secondary Departments */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secondary Department(s)</Label>
                            <Input value={secondaryLabel} readOnly disabled className="h-11 bg-muted/40 cursor-not-allowed" />
                        </div>

                        {/* Read-only: Employment Location */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Employment Location</Label>
                            <Input value={profile?.employmentLocation ?? "—"} readOnly disabled className="h-11 bg-muted/40 cursor-not-allowed" />
                        </div>

                        {/* Editable: Assigned Manager */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assigned Manager</Label>
                            <Select value={managerId} onValueChange={setManagerId}>
                                <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Select Manager" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">No Manager</SelectItem>
                                    {managers.map((m: any) => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Editable: Shift Start Time */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shift Start Time</Label>
                            <Input
                                type="time"
                                value={shiftStart}
                                onChange={(e) => setShiftStart(e.target.value)}
                                className="h-11"
                            />
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Standard start time for late calculations</p>
                        </div>

                        {/* Editable: Shift End Time */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shift End Time</Label>
                            <Input
                                type="time"
                                value={shiftEnd}
                                onChange={(e) => setShiftEnd(e.target.value)}
                                className="h-11"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-[#8B2323] hover:bg-[#701c1c]">
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
