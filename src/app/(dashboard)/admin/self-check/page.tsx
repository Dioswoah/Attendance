"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ShieldAlert, RefreshCw, Loader2, CheckCircle2, EyeOff, Sparkles } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type Finding = {
    id: string
    entityType: string
    entityId: string
    issueType: string
    description: string
    severity: "LOW" | "MEDIUM" | "HIGH"
    status: "OPEN" | "IGNORED" | "RESOLVED"
    createdAt: string
    user?: { id: string; name: string | null; email: string } | null
}

type HistoryEntry = {
    id: string
    action: string
    createdAt: string
    details: any
    user: { id: string; name: string | null; email: string } | null
}

function historyLabel(entry: HistoryEntry) {
    const actor = entry.user?.name || entry.user?.email || "Someone"
    switch (entry.action) {
        case "SELF_CHECK_RUN":
            return entry.details?.status === "FAILED"
                ? `${actor} ran a self-check — failed (${entry.details?.errorMessage || "unknown error"})`
                : `${actor} ran a self-check — ${entry.details?.findingsCount ?? 0} issue(s) found`
        case "SELF_CHECK_IGNORE":
            return `${actor} ignored a ${entry.details?.issueType || "finding"}`
        case "SELF_CHECK_RESOLVE":
            return `${actor} validated a ${entry.details?.issueType || "finding"}`
        default:
            return `${actor} — ${entry.action}`
    }
}

const SEVERITY_STYLE: Record<string, string> = {
    HIGH: "bg-destructive/10 text-destructive border-destructive/20",
    MEDIUM: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    LOW: "bg-muted text-muted-foreground border-border",
}

export default function SelfCheckPage() {
    const [findings, setFindings] = useState<Finding[]>([])
    const [history, setHistory] = useState<HistoryEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [statusFilter, setStatusFilter] = useState<string>("OPEN")

    async function loadFindings() {
        setLoading(true)
        try {
            const params = statusFilter === "ALL" ? "" : `?status=${statusFilter}`
            const res = await fetch(`/api/admin/self-check${params}`)
            if (!res.ok) throw new Error("Failed to load findings")
            const data = await res.json()
            setFindings(data.findings || [])
            setHistory(data.history || [])
        } catch (error) {
            console.error("[SelfCheck] load error:", error)
            toast.error("Failed to load self-check findings")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadFindings()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter])

    async function runSelfCheck() {
        setRunning(true)
        try {
            const res = await fetch("/api/admin/self-check", { method: "POST" })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Self-check failed")

            if (data.run?.status === "FAILED") {
                toast.error(`Self-check run failed: ${data.run.errorMessage || "Unknown error"}`)
            } else {
                toast.success(`Self-check complete — ${data.run?.findingsCount ?? 0} issue(s) found`)
            }
            await loadFindings()
        } catch (error: any) {
            console.error("[SelfCheck] run error:", error)
            toast.error(error.message || "Failed to run self-check")
        } finally {
            setRunning(false)
        }
    }

    async function updateStatus(id: string, status: "IGNORED" | "RESOLVED") {
        try {
            const res = await fetch(`/api/admin/self-check/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            if (!res.ok) throw new Error("Failed to update finding")
            setFindings((prev) => prev.filter((f) => f.id !== id || statusFilter === "ALL"))
            toast.success(status === "IGNORED" ? "Finding ignored" : "Finding validated")
            loadFindings()
        } catch (error) {
            console.error("[SelfCheck] update error:", error)
            toast.error("Failed to update finding")
        }
    }

    function confirmIgnore(finding: Finding) {
        toast("Ignore this finding?", {
            description: finding.description,
            action: { label: "Ignore", onClick: () => updateStatus(finding.id, "IGNORED") },
            cancel: { label: "Cancel", onClick: () => toast.dismiss() },
        })
    }

    return (
        <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-10 px-4 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Self-Check</h1>
                    <p className="text-muted-foreground text-sm">AI-assisted data-quality audit of attendance, leave, and amend records</p>
                </div>
                <Button onClick={runSelfCheck} disabled={running}>
                    {running ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
                    ) : (
                        <><Sparkles className="h-4 w-4 mr-2" /> Run Self-Check</>
                    )}
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="IGNORED">Ignored</SelectItem>
                        <SelectItem value="RESOLVED">Resolved</SelectItem>
                        <SelectItem value="ALL">All</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={loadFindings} disabled={loading}>
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-muted-foreground">
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading...
                        </div>
                    ) : findings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                            <p className="text-sm font-medium text-foreground">No issues found</p>
                            <p className="text-xs text-muted-foreground">Run a self-check to scan today&apos;s data for problems.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Detected</TableHead>
                                    <TableHead>Entity</TableHead>
                                    <TableHead>Affected User</TableHead>
                                    <TableHead>Issue</TableHead>
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {findings.map((f) => (
                                    <TableRow key={f.id}>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {format(new Date(f.createdAt), "MMM d, h:mm a")}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <div className="font-medium">{f.entityType}</div>
                                            <div className="text-muted-foreground">{f.issueType}</div>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {f.user ? (f.user.name || f.user.email) : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="text-xs max-w-[360px] whitespace-normal break-words">{f.description}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("text-xs", SEVERITY_STYLE[f.severity])}>
                                                {f.severity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">{f.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {f.status === "OPEN" && (
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => confirmIgnore(f)}>
                                                        <EyeOff className="h-3.5 w-3.5 mr-1" /> Ignore
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => updateStatus(f.id, "RESOLVED")}>
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Validate
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">History</h2>
                <Card>
                    <CardContent className="p-0">
                        {history.length === 0 ? (
                            <div className="py-8 text-center text-xs text-muted-foreground">No self-check activity yet.</div>
                        ) : (
                            <ul className="divide-y">
                                {history.map((entry) => (
                                    <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs">
                                        <span className="text-foreground">{historyLabel(entry)}</span>
                                        <span className="text-muted-foreground whitespace-nowrap">
                                            {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
