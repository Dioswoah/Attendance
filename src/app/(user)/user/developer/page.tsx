"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
    AlertTriangle, Check, Copy, KeyRound, Loader2, Play, Plus, Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ApiKeyRow = {
    id: string
    name: string
    keyPrefix: string
    createdAt: string
    lastUsedAt: string | null
    revokedAt: string | null
}

type EndpointParam = { name: string; type: string; description: string }

type Endpoint = {
    method: "GET"
    path: string
    title: string
    description: string
    params: EndpointParam[]
}

const ENDPOINTS: Endpoint[] = [
    {
        method: "GET",
        path: "/api/v1/attendance",
        title: "Attendance records",
        description: "Clock-in/out records with breaks. Soft-deleted records are excluded.",
        params: [
            { name: "from", type: "YYYY-MM-DD", description: "Start of date range (inclusive)" },
            { name: "to", type: "YYYY-MM-DD", description: "End of date range (inclusive)" },
            { name: "email", type: "string", description: "Filter to one employee by email" },
            { name: "page", type: "number", description: "Page number (default 1)" },
            { name: "pageSize", type: "number", description: "Rows per page (default 50, max 100)" },
        ],
    },
    {
        method: "GET",
        path: "/api/v1/employees",
        title: "Employees",
        description: "Active employee directory with department, manager and shift info.",
        params: [
            { name: "department", type: "string", description: "Filter by department name" },
            { name: "email", type: "string", description: "Look up one employee by email" },
            { name: "page", type: "number", description: "Page number (default 1)" },
            { name: "pageSize", type: "number", description: "Rows per page (default 50, max 100)" },
        ],
    },
    {
        method: "GET",
        path: "/api/v1/leaves",
        title: "Leave records",
        description: "Leave records; from/to match any leave overlapping the range.",
        params: [
            { name: "from", type: "YYYY-MM-DD", description: "Range start (matches overlapping leaves)" },
            { name: "to", type: "YYYY-MM-DD", description: "Range end (matches overlapping leaves)" },
            { name: "email", type: "string", description: "Filter to one employee by email" },
            { name: "status", type: "string", description: "e.g. APPROVED, PENDING, DECLINED" },
            { name: "page", type: "number", description: "Page number (default 1)" },
            { name: "pageSize", type: "number", description: "Rows per page (default 50, max 100)" },
        ],
    },
    {
        method: "GET",
        path: "/api/v1/departments",
        title: "Departments",
        description: "All departments with manager and active-employee headcount.",
        params: [],
    },
]

export default function DeveloperPage() {
    const router = useRouter()
    const { data: session, status } = useSession()
    const [isChecking, setIsChecking] = useState(true)

    // Like the Technicians page, the nav link is hidden for other roles but
    // direct navigation must also be blocked.
    useEffect(() => {
        if (status === "loading") return
        const roles = (session?.user as any)?.roles || []
        if (!roles.includes("DEVELOPER")) {
            router.push("/user")
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <KeyRound className="h-6 w-6" /> Developer
                </h1>
                <p className="text-sm text-muted-foreground">
                    API keys and read-only REST endpoints for integrating with the attendance data.
                </p>
            </div>
            <Tabs defaultValue="keys">
                <TabsList>
                    <TabsTrigger value="keys">API Keys</TabsTrigger>
                    <TabsTrigger value="docs">API Reference</TabsTrigger>
                </TabsList>
                <TabsContent value="keys" className="mt-4">
                    <KeysPanel />
                </TabsContent>
                <TabsContent value="docs" className="mt-4">
                    <DocsPanel />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function KeysPanel() {
    const [keys, setKeys] = useState<ApiKeyRow[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [newName, setNewName] = useState("")
    const [createOpen, setCreateOpen] = useState(false)
    const [createdKey, setCreatedKey] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/developer/keys")
            const data = await res.json()
            setKeys(data.keys || [])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const createKey = async () => {
        setCreating(true)
        setError(null)
        try {
            const res = await fetch("/api/developer/keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to create key")
                return
            }
            setCreatedKey(data.key.plaintext)
            setNewName("")
            load()
        } finally {
            setCreating(false)
        }
    }

    const revokeKey = async (id: string) => {
        await fetch(`/api/developer/keys/${id}`, { method: "DELETE" })
        load()
    }

    const copyKey = async () => {
        if (!createdKey) return
        await navigator.clipboard.writeText(createdKey)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>
                        Keys authenticate requests to the v1 endpoints. The full key is shown once at creation — store it somewhere safe.
                    </CardDescription>
                </div>
                <Button onClick={() => { setCreateOpen(true); setCreatedKey(null); setError(null) }}>
                    <Plus className="h-4 w-4 mr-1" /> New key
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : keys.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No API keys yet. Create one to start using the API.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Key</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Last used</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {keys.map((k) => (
                                <TableRow key={k.id}>
                                    <TableCell className="font-medium">{k.name}</TableCell>
                                    <TableCell className="font-mono text-xs">{k.keyPrefix}…</TableCell>
                                    <TableCell>{new Date(k.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</TableCell>
                                    <TableCell>
                                        {k.revokedAt
                                            ? <Badge variant="secondary">Revoked</Badge>
                                            : <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {!k.revokedAt && (
                                            <Button variant="ghost" size="sm" onClick={() => revokeKey(k.id)} title="Revoke key">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setCreatedKey(null) } }}>
                <DialogContent>
                    {createdKey ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Key created</DialogTitle>
                                <DialogDescription>
                                    Copy your key now — for security it is stored hashed and <strong>cannot be shown again</strong>.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">{createdKey}</code>
                                <Button variant="outline" size="sm" onClick={copyKey}>
                                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                Treat this key like a password. Anyone holding it can read attendance data.
                            </div>
                            <DialogFooter>
                                <Button onClick={() => { setCreateOpen(false); setCreatedKey(null) }}>Done</Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>Create API key</DialogTitle>
                                <DialogDescription>Give the key a name that says where it will be used.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                                <Label htmlFor="key-name">Key name</Label>
                                <Input
                                    id="key-name"
                                    placeholder="e.g. n8n integration"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    maxLength={60}
                                />
                                {error && <p className="text-sm text-destructive">{error}</p>}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                                <Button onClick={createKey} disabled={creating || !newName.trim()}>
                                    {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Create
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    )
}

function DocsPanel() {
    const [tryKey, setTryKey] = useState("")

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Authentication</CardTitle>
                    <CardDescription>
                        All v1 endpoints are read-only (GET). Send your API key with every request, either way:
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <pre className="rounded bg-muted p-3 text-xs font-mono overflow-x-auto">{`Authorization: Bearer rsa_your_key_here
# or
x-api-key: rsa_your_key_here`}</pre>
                    <div className="space-y-2">
                        <Label htmlFor="try-key">API key for “Try it” requests (kept only in this page)</Label>
                        <Input
                            id="try-key"
                            type="password"
                            placeholder="rsa_…"
                            value={tryKey}
                            onChange={(e) => setTryKey(e.target.value)}
                            className="font-mono"
                        />
                    </div>
                </CardContent>
            </Card>
            {ENDPOINTS.map((ep) => (
                <EndpointCard key={ep.path} endpoint={ep} tryKey={tryKey} />
            ))}
        </div>
    )
}

function EndpointCard({ endpoint, tryKey }: { endpoint: Endpoint; tryKey: string }) {
    const [paramValues, setParamValues] = useState<Record<string, string>>({})
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState<{ status: number; body: string } | null>(null)

    const buildUrl = () => {
        const qs = new URLSearchParams()
        for (const p of endpoint.params) {
            const v = paramValues[p.name]?.trim()
            if (v) qs.set(p.name, v)
        }
        return endpoint.path + (qs.size ? `?${qs.toString()}` : "")
    }

    const runRequest = async () => {
        setRunning(true)
        setResult(null)
        try {
            const res = await fetch(buildUrl(), { headers: { "x-api-key": tryKey } })
            const text = await res.text()
            let pretty = text
            try { pretty = JSON.stringify(JSON.parse(text), null, 2) } catch { /* leave as-is */ }
            setResult({ status: res.status, body: pretty })
        } catch (e: any) {
            setResult({ status: 0, body: String(e?.message || e) })
        } finally {
            setRunning(false)
        }
    }

    const curl = `curl -H "x-api-key: rsa_…" "https://<staging-host>${buildUrl()}"`

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-mono">GET</Badge>
                    <code className="text-sm font-mono">{endpoint.path}</code>
                </div>
                <CardTitle className="text-base mt-1">{endpoint.title}</CardTitle>
                <CardDescription>{endpoint.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {endpoint.params.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {endpoint.params.map((p) => (
                            <div key={p.name} className="space-y-1">
                                <Label htmlFor={`${endpoint.path}-${p.name}`} className="text-xs">
                                    <span className="font-mono">{p.name}</span>
                                    <span className="text-muted-foreground ml-1">({p.type}) — {p.description}</span>
                                </Label>
                                <Input
                                    id={`${endpoint.path}-${p.name}`}
                                    value={paramValues[p.name] || ""}
                                    onChange={(e) => setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                                    className="h-8 text-sm"
                                />
                            </div>
                        ))}
                    </div>
                )}
                <pre className="rounded bg-muted p-3 text-xs font-mono overflow-x-auto">{curl}</pre>
                <div className="flex items-center gap-2">
                    <Button size="sm" onClick={runRequest} disabled={running || !tryKey.trim()}>
                        {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                        Try it
                    </Button>
                    {!tryKey.trim() && <span className="text-xs text-muted-foreground">Paste an API key above to enable</span>}
                </div>
                {result && (
                    <div className="space-y-1">
                        <Badge variant={result.status >= 200 && result.status < 300 ? "default" : "destructive"}>
                            {result.status || "Network error"}
                        </Badge>
                        <pre className="rounded bg-muted p-3 text-xs font-mono overflow-x-auto max-h-80 overflow-y-auto">{result.body}</pre>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
