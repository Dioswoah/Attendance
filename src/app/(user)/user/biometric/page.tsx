"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { format, subDays, startOfMonth } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Fingerprint, CheckCircle2, XCircle, AlertTriangle,
    Loader2, Minus
} from "lucide-react"

const PRESETS = [
    {
        label: "Last 7 Days",
        getStart: () => format(subDays(new Date(), 7), "yyyy-MM-dd"),
    },
    {
        label: "Last 14 Days",
        getStart: () => format(subDays(new Date(), 14), "yyyy-MM-dd"),
    },
    {
        label: "This Month",
        getStart: () => format(startOfMonth(new Date()), "yyyy-MM-dd"),
    },
]

const today = format(new Date(), "yyyy-MM-dd")

export default function BiometricPage() {
    const { data: session } = useSession()
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 14), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(today)
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState("")

    const isPhilippines = (session?.user as any)?.location === "Philippines"

    if (!isPhilippines) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
                <Fingerprint className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm font-semibold text-muted-foreground">
                    Biometric records are only available for Philippines-based staff.
                </p>
            </div>
        )
    }

    const load = async () => {
        setLoading(true)
        setError("")
        try {
            const res = await fetch(
                `/api/user/biometric/range?startDate=${startDate}&endDate=${endDate}`
            )
            if (!res.ok) throw new Error()
            const data = await res.json()
            setRecords(data.records || [])
            setLoaded(true)
        } catch {
            setError("Failed to load biometric records. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-10 px-4 lg:px-8">

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Fingerprint className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Biometric Records</h1>
                    <p className="text-sm text-muted-foreground">
                        Compare your biometric clock-in times against your app records
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card className="border border-border shadow-sm bg-white">
                <CardContent className="p-6 space-y-5">
                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map((p) => (
                            <Button
                                key={p.label}
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-medium"
                                onClick={() => {
                                    setStartDate(p.getStart())
                                    setEndDate(today)
                                }}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>From</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>To</Label>
                            <Input
                                type="date"
                                value={endDate}
                                max={today}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Maximum 14 working days per query.
                    </p>

                    <Button
                        onClick={load}
                        disabled={loading}
                        className="bg-primary hover:bg-primary/90 text-white"
                    >
                        {loading ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</>
                        ) : (
                            <><Fingerprint className="h-4 w-4 mr-2" />Load Records</>
                        )}
                    </Button>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                </CardContent>
            </Card>

            {/* Results */}
            {loaded && (
                <Card className="border border-border shadow-sm bg-white overflow-hidden">
                    {records.length === 0 ? (
                        <div className="p-10 text-center text-sm text-muted-foreground">
                            No records found for the selected date range.
                        </div>
                    ) : (
                        <>
                            {/* Legend */}
                            <div className="flex flex-wrap gap-4 px-5 py-3 border-b border-border bg-muted/20 text-[11px]">
                                <span className="flex items-center gap-1.5 text-green-600 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Match — within 15 min</span>
                                <span className="flex items-center gap-1.5 text-red-600 font-semibold"><XCircle className="h-3.5 w-3.5" /> Discrepancy — over 15 min</span>
                                <span className="flex items-center gap-1.5 text-muted-foreground font-medium"><AlertTriangle className="h-3.5 w-3.5" /> No biometric record found</span>
                                <span className="flex items-center gap-1.5 text-muted-foreground font-medium"><Minus className="h-3.5 w-3.5" /> Absent</span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/40 border-b border-border">
                                        <tr>
                                            {["Date", "App Clock-In", "App Clock-Out", "Biometric First-In", "Difference", "Status"].map((h) => (
                                                <th
                                                    key={h}
                                                    className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                                                >
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {records.map((r: any) => (
                                            <tr key={r.date} className="hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-3 font-medium whitespace-nowrap">
                                                    {format(new Date(r.date + "T12:00:00"), "EEE, dd MMM yyyy")}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">
                                                    {r.appClockIn
                                                        ? format(new Date(r.appClockIn), "h:mm a")
                                                        : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">
                                                    {r.appClockOut
                                                        ? format(new Date(r.appClockOut), "h:mm a")
                                                        : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">
                                                    {r.bioFirstIn || <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {r.diffMinutes !== null ? (
                                                        <span className={r.diffMinutes > 15 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                                                            {r.diffMinutes}m
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {r.status === "match" && (
                                                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold">
                                                            <CheckCircle2 className="h-4 w-4" /> Match
                                                        </span>
                                                    )}
                                                    {r.status === "discrepancy" && (
                                                        <span className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold">
                                                            <XCircle className="h-4 w-4" /> Discrepancy
                                                        </span>
                                                    )}
                                                    {r.status === "no_biometric" && (
                                                        <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                                                            <AlertTriangle className="h-3.5 w-3.5" /> No biometric record
                                                        </span>
                                                    )}
                                                    {r.status === "absent" && (
                                                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                                                            <Minus className="h-3.5 w-3.5" /> Absent
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </Card>
            )}
        </div>
    )
}
