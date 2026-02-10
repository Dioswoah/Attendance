"use client"

import { useState, useEffect } from "react"
import { Globe, Check, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
    TIMEZONES,
    getBrowserTimezone,
    getTimezonesByRegion,
    getTimezoneOffset,
    formatWithTimezone
} from "@/lib/timezone"

interface TimezoneSettingsProps {
    compact?: boolean
    showLabel?: boolean
}

export function TimezoneSettings({ compact = false, showLabel = true }: TimezoneSettingsProps) {
    const { data: session, update } = useSession()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Local state for the dialog
    const [useCurrentTimezone, setUseCurrentTimezone] = useState(true)
    const [selectedTimezone, setSelectedTimezone] = useState("UTC")
    const [browserTimezone, setBrowserTimezone] = useState("UTC")

    // Load user preferences from session
    useEffect(() => {
        if (session?.user) {
            const user = session.user as any
            setUseCurrentTimezone(user.useCurrentTimezone ?? true)
            setSelectedTimezone(user.selectedTimezone ?? "UTC")
        }
        setBrowserTimezone(getBrowserTimezone())
    }, [session])

    // Get the effective timezone
    const effectiveTimezone = useCurrentTimezone ? browserTimezone : selectedTimezone

    // Get current time in the effective timezone
    const [currentTime, setCurrentTime] = useState("")
    useEffect(() => {
        const updateTime = () => {
            setCurrentTime(formatWithTimezone(new Date(), effectiveTimezone, 'time'))
        }
        updateTime()
        const interval = setInterval(updateTime, 1000)
        return () => clearInterval(interval)
    }, [effectiveTimezone])

    const handleSave = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/user/timezone', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    useCurrentTimezone,
                    selectedTimezone
                })
            })

            if (!response.ok) {
                throw new Error('Failed to update timezone settings')
            }

            const updatedUser = await response.json()

            // Update the session with all fields returned from server (including synced location)
            await update({
                ...session,
                user: {
                    ...session?.user,
                    useCurrentTimezone: updatedUser.useCurrentTimezone,
                    selectedTimezone: updatedUser.selectedTimezone,
                    location: updatedUser.location
                }
            })

            toast.success(`Times will now be displayed in ${useCurrentTimezone ? 'your current timezone' : selectedTimezone}`)

            setOpen(false)
        } catch (error) {
            console.error('Failed to update timezone:', error)
            toast.error("Failed to update timezone settings. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const timezonesByRegion = getTimezonesByRegion()
    const currentOffset = getTimezoneOffset(effectiveTimezone)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {compact ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg"
                        title="Timezone Settings"
                    >
                        <Globe className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        className="gap-2 h-9 rounded-lg border-border hover:bg-muted"
                    >
                        <Globe className="h-4 w-4" />
                        {showLabel && <span className="text-xs font-medium">Timezone</span>}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        Timezone Settings
                    </DialogTitle>
                    <DialogDescription>
                        Choose how you want times to be displayed throughout the application.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Current Time Display */}
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium text-foreground">Current Time</p>
                                <p className="text-xs text-muted-foreground">
                                    {effectiveTimezone} ({currentOffset})
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold font-mono text-foreground">{currentTime}</p>
                        </div>
                    </div>

                    {/* Timezone Mode Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold">Timezone Mode</Label>
                        <RadioGroup
                            value={useCurrentTimezone ? "current" : "manual"}
                            onValueChange={(value) => setUseCurrentTimezone(value === "current")}
                        >
                            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                                <RadioGroupItem value="current" id="current" className="mt-0.5" />
                                <div className="flex-1">
                                    <Label htmlFor="current" className="cursor-pointer font-medium">
                                        Use My Current Timezone
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Automatically detect and use your browser's timezone ({browserTimezone})
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                                <RadioGroupItem value="manual" id="manual" className="mt-0.5" />
                                <div className="flex-1">
                                    <Label htmlFor="manual" className="cursor-pointer font-medium">
                                        Select a Specific Timezone
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Choose a timezone from the list below
                                    </p>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Timezone Selector (only shown when manual mode is selected) */}
                    {!useCurrentTimezone && (
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">Select Timezone</Label>
                            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a timezone" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {Object.entries(timezonesByRegion).map(([region, timezones]) => (
                                        <SelectGroup key={region}>
                                            <SelectLabel className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                                                {region}
                                            </SelectLabel>
                                            {timezones.map((tz) => (
                                                <SelectItem key={tz.value} value={tz.value}>
                                                    <div className="flex items-center justify-between w-full gap-4">
                                                        <span className="text-sm">{tz.label}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">
                                                            {tz.offset}
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-900 dark:text-blue-100">
                            <strong>Note:</strong> All times are stored in UTC in the database.
                            This setting only affects how times are displayed to you.
                            Daylight Saving Time (DST) is handled automatically.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4" />
                                Save Settings
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
