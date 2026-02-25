"use client"

import { useState, useEffect } from "react"
import { Clock, Edit } from "lucide-react"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export function WorkHoursSettings() {
    const [userProfile, setUserProfile] = useState<any>(null)
    const [showScheduleInput, setShowScheduleInput] = useState(false)
    const [scheduledStart, setScheduledStart] = useState("09:00")
    const [scheduledEnd, setScheduledEnd] = useState("17:00")

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch('/api/user/me')
                if (res.ok) {
                    const data = await res.json()
                    setUserProfile(data)
                    if (data.shiftStartTime && data.shiftEndTime) {
                        setScheduledStart(data.shiftStartTime)
                        setScheduledEnd(data.shiftEndTime)
                    }
                }
            } catch (error) {
                console.error("Failed to fetch user profile", error)
            }
        }
        fetchProfile()
    }, [])

    const handleUpdateWorkHours = async () => {
        if (!scheduledStart || !scheduledEnd) {
            toast.error("Please set both start and end times")
            return
        }

        const previousProfile = userProfile ? { ...userProfile } : null
        setUserProfile((prev: any) => ({
            ...prev,
            shiftStartTime: scheduledStart,
            shiftEndTime: scheduledEnd
        }))
        setShowScheduleInput(false)

        try {
            const res = await fetch('/api/user/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftStartTime: scheduledStart,
                    shiftEndTime: scheduledEnd
                })
            })

            if (res.ok) {
                const updated = await res.json()
                setUserProfile(updated)
                toast.success("Work hours updated successfully")
            } else {
                setUserProfile(previousProfile)
                toast.error("Failed to update work hours")
            }
        } catch (error) {
            setUserProfile(previousProfile)
            toast.error("Failed to update work hours")
        }
    }

    if (!userProfile) return null; // Wait until loaded

    return (
        <>
            <button
                className="flex items-center w-full px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-all cursor-pointer group mb-1"
                onClick={() => setShowScheduleInput(true)}
            >
                <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center text-[#8B2323] shrink-0 group-hover:bg-red-100 transition-colors">
                    <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1 ml-3 flex flex-col items-start">
                    <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-slate-700">Work Hours</span>
                        <Edit className="w-3 h-3 text-slate-300 group-hover:text-red-500 transition-colors" />
                    </div>
                    <p className="text-[10px] font-mono font-bold text-red-600 mt-0.5">
                        {(userProfile.shiftStartTime && userProfile.shiftEndTime) ?
                            `${userProfile.shiftStartTime} - ${userProfile.shiftEndTime}` :
                            'Not Set'}
                    </p>
                </div>
            </button>

            <Dialog open={showScheduleInput} onOpenChange={setShowScheduleInput}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Standard Schedule</DialogTitle>
                        <DialogDescription>
                            Set your expected shift times. This helps calculate overtime and late arrivals.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Time</Label>
                                <Input type="time" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Time</Label>
                                <Input type="time" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowScheduleInput(false)}>Cancel</Button>
                        <Button onClick={handleUpdateWorkHours} className="bg-[#8B2323] hover:bg-[#701c1c]">Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
