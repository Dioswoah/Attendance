"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
    AlertTriangle, Check, ChevronDown, Copy, FileText, KeyRound, Loader2, Play, Plus, Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
    responseNotes?: string
    exampleResponse: string
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
        responseNotes: "All timestamps are UTC ISO-8601. clockOut is null while a session is still open. duration is minutes worked (null until clock-out). source is one of WEB, SIMPRO, BIOMETRIC, MANUAL. Records are ordered newest first.",
        exampleResponse: `{
  "page": 1,
  "pageSize": 50,
  "total": 128,
  "records": [
    {
      "id": "cmrsfzj0n0051388zrpwt9y0k",
      "date": "2026-07-20T00:00:00.000Z",
      "clockIn": "2026-07-19T23:02:00.000Z",
      "clockOut": null,
      "status": "PRESENT",
      "mode": "ONSITE",
      "source": "SIMPRO",
      "duration": null,
      "notes": "Auto clock-in from simPRO: Mobile status set to Onsite (09:02) on job 446103-368817",
      "user": {
        "id": "cmro2suic0005pxabdapcekc5",
        "name": "Dylan Jackson",
        "email": "dylanj@redadair.com.au"
      },
      "breaks": [
        { "startTime": "2026-07-20T02:00:00.000Z", "endTime": "2026-07-20T02:30:00.000Z" }
      ]
    }
  ]
}`,
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
        responseNotes: "Only active (non-archived) employees are returned, ordered by name. workingDays is a comma-separated list. shift times are the employee's local wall-clock times. department and manager are null when unassigned. isTechnician is true when the employee is linked to simPRO (see the Technicians board).",
        exampleResponse: `{
  "page": 1,
  "pageSize": 50,
  "total": 101,
  "employees": [
    {
      "id": "cmro2stwq0001pxabcuh58egz",
      "name": "Adam Swindail",
      "email": "adams@redadair.com.au",
      "roles": ["USER"],
      "employmentLocation": "Australia",
      "shiftStartTime": "08:00",
      "shiftEndTime": "17:00",
      "workingDays": "MON,TUE,WED,THU,FRI",
      "isTechnician": true,
      "department": { "id": "cmocgir5q0003ilknkg7i6jew", "name": "Redmen" },
      "manager": { "id": "cmnzbxoqw009e1209nfswgm6j", "name": "Chris Wyborn", "email": "chrisw@redadair.com.au" }
    }
  ]
}`,
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
        responseNotes: "startDate/endDate are UTC ISO-8601; a leave overlaps the from/to range if any of its days fall inside it. status is APPROVED, PENDING or DECLINED. type values include VACATION, SICK, PERSONAL. duration is human-readable (e.g. \"28 Days\", \"Half Day\"). Ordered by startDate, newest first.",
        exampleResponse: `{
  "page": 1,
  "pageSize": 50,
  "total": 27,
  "leaves": [
    {
      "id": "cmomgg0qb003512bhv53jxwr6",
      "startDate": "2026-12-07T00:00:00.000Z",
      "endDate": "2027-01-03T00:00:00.000Z",
      "type": "VACATION",
      "status": "APPROVED",
      "duration": "28 Days",
      "user": {
        "id": "cmnzbxoqw009e1209nfswgm6j",
        "name": "Beau Hannan",
        "email": "beauh@redadair.com.au"
      }
    }
  ]
}`,
    },
    {
        method: "GET",
        path: "/api/v1/departments",
        title: "Departments",
        description: "All departments with manager and active-employee headcount.",
        params: [],
        responseNotes: "Not paginated — always returns the full list, ordered by name. employeeCount counts active (non-archived) staff whose primary department this is. manager is null when unassigned.",
        exampleResponse: `{
  "departments": [
    {
      "id": "cmocgi34t0000ilkngcwms3ks",
      "name": "Adair",
      "shiftStartTime": "09:00",
      "manager": null,
      "employeeCount": 14
    },
    {
      "id": "cmocgir5q0003ilknkg7i6jew",
      "name": "Redmen",
      "shiftStartTime": "08:00",
      "manager": { "id": "cmnzbxoqw009e1209nfswgm6j", "name": "Chris Wyborn", "email": "chrisw@redadair.com.au" },
      "employeeCount": 27
    }
  ]
}`,
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

const AUTH_HEADER_EXAMPLE = `Authorization: Bearer rsa_your_key_here
# or
x-api-key: rsa_your_key_here`

const AUTH_ERRORS_EXAMPLE = `401 Unauthorized   {"error": "Invalid or missing API key"}     — key missing, wrong, or revoked
400 Bad Request    {"error": "from must be YYYY-MM-DD"}        — invalid query parameter
Content-Type: application/json on every response`

function authMarkdown(): string {
    return [
        "## Authentication",
        "",
        "All v1 endpoints are read-only (GET). Send your API key with every request, either way:",
        "",
        "```",
        AUTH_HEADER_EXAMPLE,
        "```",
        "",
        "### Error responses",
        "",
        "```",
        AUTH_ERRORS_EXAMPLE,
        "```",
    ].join("\n")
}

function endpointMarkdown(ep: Endpoint): string {
    const lines: string[] = []
    lines.push(`## ${ep.method} ${ep.path} — ${ep.title}`, "")
    lines.push(ep.description, "")
    if (ep.params.length) {
        lines.push("**Query parameters**", "")
        for (const p of ep.params) lines.push(`- \`${p.name}\` (${p.type}) — ${p.description}`)
        lines.push("")
    }
    lines.push("**Example request**", "")
    lines.push("```bash")
    lines.push(`curl -H "x-api-key: rsa_…" "https://<staging-host>${ep.path}"`)
    lines.push("```", "")
    lines.push("**Example response — 200 OK**", "")
    if (ep.responseNotes) lines.push(ep.responseNotes, "")
    lines.push("```json")
    lines.push(ep.exampleResponse)
    lines.push("```")
    return lines.join("\n")
}

function fullDocMarkdown(): string {
    return ["# RSA API Reference", "", authMarkdown(), "", ...ENDPOINTS.map(endpointMarkdown)].join("\n\n")
}

/** Small copy icon that appears in the corner of a code block on hover. */
function CodeBlock({ code, className }: { code: string; className?: string }) {
    const [copied, setCopied] = useState(false)
    const copy = async () => {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <div className="relative group">
            <pre className={`rounded bg-muted p-3 pr-10 text-xs font-mono overflow-x-auto ${className || ""}`}>{code}</pre>
            <button
                type="button"
                onClick={copy}
                title="Copy"
                className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded border bg-background/80 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
        </div>
    )
}

/** "Copy page" split button — main click copies Markdown, dropdown offers Copy / View as Markdown. */
function MarkdownAccessButton({ getMarkdown, label = "Copy page" }: { getMarkdown: () => string; label?: string }) {
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        await navigator.clipboard.writeText(getMarkdown())
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const viewAsMarkdown = () => {
        const blob = new Blob([getMarkdown()], { type: "text/plain;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        window.open(url, "_blank")
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
    }

    return (
        <div className="flex shrink-0">
            <Button variant="outline" size="sm" className="rounded-r-none border-r-0" onClick={copy}>
                {copied ? <Check className="h-4 w-4 mr-1.5 text-green-600" /> : <Copy className="h-4 w-4 mr-1.5" />}
                {copied ? "Copied" : label}
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-l-none px-1.5">
                        <ChevronDown className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={copy}>
                        <Copy className="h-4 w-4 mr-2" /> Copy page
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={viewAsMarkdown}>
                        <FileText className="h-4 w-4 mr-2" /> View as Markdown
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

function DocsPanel() {
    const [tryKey, setTryKey] = useState("")

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h2 className="text-lg font-semibold">API Reference</h2>
                    <p className="text-xs text-muted-foreground">
                        Copy this documentation as Markdown to paste into an AI assistant or LLM.
                    </p>
                </div>
                <MarkdownAccessButton getMarkdown={fullDocMarkdown} />
            </div>
            <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2">
                    <div>
                        <CardTitle>Authentication</CardTitle>
                        <CardDescription>
                            All v1 endpoints are read-only (GET). Send your API key with every request, either way:
                        </CardDescription>
                    </div>
                    <MarkdownAccessButton getMarkdown={authMarkdown} label="Copy section" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <CodeBlock code={AUTH_HEADER_EXAMPLE} />
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Error responses</p>
                        <CodeBlock code={AUTH_ERRORS_EXAMPLE} />
                    </div>
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
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-mono">GET</Badge>
                            <code className="text-sm font-mono">{endpoint.path}</code>
                        </div>
                        <CardTitle className="text-base mt-1">{endpoint.title}</CardTitle>
                        <CardDescription>{endpoint.description}</CardDescription>
                    </div>
                    <MarkdownAccessButton getMarkdown={() => endpointMarkdown(endpoint)} label="Copy section" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {endpoint.params.length > 0 && (
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Query parameters</p>
                )}
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
                <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Example request</p>
                    <CodeBlock code={curl} />
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Example response — 200 OK</p>
                    {endpoint.responseNotes && (
                        <p className="text-xs text-muted-foreground">{endpoint.responseNotes}</p>
                    )}
                    <CodeBlock code={endpoint.exampleResponse} className="max-h-96 overflow-y-auto" />
                </div>
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
                        <CodeBlock code={result.body} className="max-h-80 overflow-y-auto" />
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
