"use client"

import { useState } from "react"
import { Globe } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    TIMEZONES,
    getTimezonesByRegion,
    getTimezoneOffset
} from "@/lib/timezone"

interface AdminTimezoneSelectProps {
    value: string
    onChange: (timezone: string) => void
    label?: string
    className?: string
}

export function AdminTimezoneSelect({
    value,
    onChange,
    label = "Report Timezone",
    className = ""
}: AdminTimezoneSelectProps) {
    const timezonesByRegion = getTimezonesByRegion()
    const currentOffset = getTimezoneOffset(value)

    return (
        <div className={`space-y-2 ${className}`}>
            <Label className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                {label}
            </Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select timezone for report">
                        {value && (
                            <span className="flex items-center gap-2">
                                <span>{TIMEZONES.find(tz => tz.value === value)?.label}</span>
                                <span className="text-xs text-muted-foreground font-mono">
                                    ({currentOffset})
                                </span>
                            </span>
                        )}
                    </SelectValue>
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
            <p className="text-xs text-muted-foreground">
                All exported times will include UTC, timezone offset, and adjusted time for the selected timezone.
            </p>
        </div>
    )
}
