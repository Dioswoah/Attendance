"use client"

import { useState, useEffect } from "react"
import { User, Edit, Loader2, ChevronDown } from "lucide-react"
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"

export function ProfileSettings() {
    const [open, setOpen] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [managers, setManagers] = useState<any[]>([])
    const [departments, setDepartments] = useState<any[]>([])
    const [shiftStart, setShiftStart] = useState("")
    const [shiftEnd, setShiftEnd] = useState("")
    const [managerId, setManagerId] = useState("")
    const [primaryDeptId, setPrimaryDeptId] = useState("")
    const [secondaryDeptIds, setSecondaryDeptIds] = useState<string[]>([])
    const [employmentLocation, setEmploymentLocation] = useState("")
    const [workingDays, setWorkingDays] = useState<string[]>(["MON","TUE","WED","THU","FRI"])
    const [saving, setSaving] = useState(false)

    const ALL_DAYS = ["MON","TUE","WED","THU","FRI","SAT","SUN"]
    const DAY_LABELS: Record<string,string> = { MON:"Mon", TUE:"Tue", WED:"Wed", THU:"Thu", FRI:"Fri", SAT:"Sat", SUN:"Sun" }

    const toggleDay = (day: string) => {
        setWorkingDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
    }

    useEffect(() => {
        if (!open) return
        const load = async () => {
            try {
                const [profileRes, managersRes, deptsRes] = await Promise.all([
                    fetch('/api/user/me'),
                    fetch('/api/managers'),
                    fetch('/api/departments'),
                ])
                if (profileRes.ok) {
                    const data = await profileRes.json()
                    setProfile(data)
                    setShiftStart(data.shiftStartTime || "09:00")
                    setShiftEnd(data.shiftEndTime || "17:00")
                    setManagerId(data.managerId || "unassigned")
                    setPrimaryDeptId(data.departmentId || "unassigned")
                    setSecondaryDeptIds((data.secondaryDepartments ?? []).map((d: any) => d.id))
                    setEmploymentLocation(data.employmentLocation || "")
                    setWorkingDays(data.workingDays ? data.workingDays.split(',') : ["MON","TUE","WED","THU","FRI"])
                }
                if (managersRes.ok) setManagers(await managersRes.json())
                if (deptsRes.ok) setDepartments(await deptsRes.json())
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
                    departmentId: primaryDeptId || "unassigned",
                    secondaryDepartmentIds: secondaryDeptIds,
                    location: employmentLocation || undefined,
                    workingDays,
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

    const secondaryLabel =
        secondaryDeptIds.length === 0
            ? "None"
            : departments
                .filter(d => secondaryDeptIds.includes(d.id))
                .map(d => d.name)
                .join(", ") || "None"

    const toggleSecondary = (id: string) => {
        setSecondaryDeptIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

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
                        <DialogDescription>Update your profile details. Full name and corporate email cannot be changed.</DialogDescription>
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

                        {/* Editable: Primary Department */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary Department</Label>
                            <Select value={primaryDeptId} onValueChange={setPrimaryDeptId}>
                                <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {departments.map((d: any) => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Editable: Secondary Departments */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secondary Department(s)</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-11 w-full justify-between font-normal text-sm">
                                        <span className="truncate text-left">{secondaryLabel}</span>
                                        <ChevronDown className="h-4 w-4 ml-2 opacity-50 shrink-0" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-64 p-2" align="start">
                                    <DropdownMenuLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select Departments</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <div className="max-h-[220px] overflow-y-auto space-y-1 mt-1">
                                        {departments.map((d: any) => (
                                            <div
                                                key={d.id}
                                                className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                onClick={(e) => { e.preventDefault(); toggleSecondary(d.id) }}
                                            >
                                                <Checkbox id={`sec-${d.id}`} checked={secondaryDeptIds.includes(d.id)} />
                                                <label htmlFor={`sec-${d.id}`} className="text-xs font-medium cursor-pointer flex-1">{d.name}</label>
                                            </div>
                                        ))}
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Editable: Employment Location */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Employment Location</Label>
                            <Select value={employmentLocation} onValueChange={setEmploymentLocation}>
                                <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Select Location" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Philippines">Philippines</SelectItem>
                                    <SelectItem value="Australia">Australia</SelectItem>
                                </SelectContent>
                            </Select>
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

                        {/* Editable: Working Days */}
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Working Days</Label>
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Notifications are only sent on your working days</p>
                            <div className="flex gap-1.5 flex-wrap">
                                {ALL_DAYS.map(day => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleDay(day)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                                            workingDays.includes(day)
                                                ? "bg-[#8B2323] text-white border-[#8B2323]"
                                                : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                                        }`}
                                    >
                                        {DAY_LABELS[day]}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-1">
                                <button type="button" onClick={() => setWorkingDays(["MON","TUE","WED","THU","FRI"])} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#8B2323] transition-colors">Mon–Fri</button>
                                <span className="text-slate-300 text-[10px]">·</span>
                                <button type="button" onClick={() => setWorkingDays(["MON","TUE","WED","THU"])} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#8B2323] transition-colors">Mon–Thu</button>
                                <span className="text-slate-300 text-[10px]">·</span>
                                <button type="button" onClick={() => setWorkingDays(["MON","TUE","WED","THU","FRI","SAT"])} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#8B2323] transition-colors">Mon–Sat</button>
                            </div>
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
