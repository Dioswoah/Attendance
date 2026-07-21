"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { AlertTriangle, Loader2, RefreshCcw, Search, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type StaffRow = {
    id: string
    name: string | null
    email: string
    linked: boolean
    lastSyncedAt: string | null
    balances: { name: string; hours: number }[]
}

export default function AdminXeroPage() {
    const router = useRouter()
    const { data: session, status } = useSession()
    const [isChecking, setIsChecking] = useState(true)

    useEffect(() => {
        if (status === "loading") return
        const roles = (session?.user as any)?.roles || []
        if (!roles.includes("ADMIN")) {
            router.push("/admin")
        } else {
            setIsChecking(false)
        }
    }, [status, session, router])

    if (isChecking) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return <XeroLeaveCreditsPanel />
}

function XeroLeaveCreditsPanel() {
    const [staff, setStaff] = useState<StaffRow[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [syncing, setSyncing] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/xero/leave-balances")
            const data = await res.json()
            setStaff(data.staff || [])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const refresh = async () => {
        setSyncing(true)
        try {
            const res = await fetch("/api/xero/sync-leave-balances", { method: "POST" })
            const data = await res.json()
            if (!res.ok || !data.success) {
                toast.error(data.error || "Failed to sync from Xero")
                return
            }
            toast.success(`Synced ${data.synced} staff (${data.skipped} skipped — no Xero match)`)
            await load()
        } catch {
            toast.error("Failed to reach Xero")
        } finally {
            setSyncing(false)
        }
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return staff
        return staff.filter(s =>
            (s.name || "").toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q)
        )
    }, [staff, search])

    const leaveTypes = useMemo(() => {
        const names = new Set<string>()
        for (const s of staff) for (const b of s.balances) names.add(b.name)
        return Array.from(names).sort()
    }, [staff])

    return (
        <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-10 px-4 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <Wallet className="h-7 w-7" /> Xero Leave Credits
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Consolidated leave balances synced from Xero — Australia-based staff only. Read from our own database, never live from Xero.
                    </p>
                </div>
                <Button onClick={refresh} disabled={syncing}>
                    {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                    {syncing ? "Syncing…" : "Refresh from Xero"}
                </Button>
            </div>

            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2">
                    <div>
                        <CardTitle>Staff leave balances</CardTitle>
                        <CardDescription>
                            Staff with no Xero match are likely in a different Xero company/tenant than the one currently connected.
                        </CardDescription>
                    </div>
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, email or ID…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-9"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                            {staff.length === 0 ? "No Australia-based staff found." : "No staff match your search."}
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Staff</TableHead>
                                    <TableHead>Xero</TableHead>
                                    {leaveTypes.map(t => <TableHead key={t} className="text-right">{t}</TableHead>)}
                                    <TableHead>Last synced</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell>
                                            <p className="font-medium">{s.name || "—"}</p>
                                            <p className="text-xs text-muted-foreground">{s.email}</p>
                                        </TableCell>
                                        <TableCell>
                                            {s.linked ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Linked</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> No match
                                                </Badge>
                                            )}
                                        </TableCell>
                                        {leaveTypes.map(t => {
                                            const bal = s.balances.find(b => b.name === t)
                                            return (
                                                <TableCell key={t} className="text-right font-mono text-sm">
                                                    {bal ? bal.hours.toFixed(1) : "—"}
                                                </TableCell>
                                            )
                                        })}
                                        <TableCell className="text-xs text-muted-foreground">
                                            {s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString() : "Never"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
