"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Mail, User, ShieldAlert, Loader2, Send, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock } from "lucide-react"

export default function AdminNotificationsPage() {
    const [employees, setEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    // Notification State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [notificationType, setNotificationType] = useState<string>("LATE_ARRIVAL")
    const [customTitle, setCustomTitle] = useState("")
    const [customSubject, setCustomSubject] = useState("")
    const [customMessage, setCustomMessage] = useState("")
    const [deliveryMethod, setDeliveryMethod] = useState<"BOTH" | "IN_APP" | "EMAIL">("BOTH")

    // Logs State
    const [logs, setLogs] = useState<any[]>([])
    const [loadingLogs, setLoadingLogs] = useState(false)

    // Submit State
    const [isSending, setIsSending] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await fetch('/api/employees')
                if (res.ok) {
                    const data = await res.json()
                    // Only show active employees
                    setEmployees(data.filter((e: any) => !e.isArchived))
                }
            } catch (error) {
                console.error("Failed to load staff")
            } finally {
                setLoading(false)
            }
        }
        fetchEmployees()
    }, [])

    const fetchLogs = async () => {
        setLoadingLogs(true)
        try {
            const res = await fetch('/api/admin/notifications/logs')
            if (res.ok) {
                const data = await res.json()
                setLogs(data)
            }
        } catch (error) {
            console.error("Failed to load notification logs")
        } finally {
            setLoadingLogs(false)
        }
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredEmployees.map(e => e.id)))
        } else {
            setSelectedIds(new Set())
        }
    }

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds)
        if (checked) newSelected.add(id)
        else newSelected.delete(id)
        setSelectedIds(newSelected)
    }

    const filteredEmployees = employees.filter(emp => {
        return emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    const handleSendNotification = async () => {
        if (selectedIds.size === 0) return

        setIsSending(true)
        try {
            const payload = {
                userIds: Array.from(selectedIds),
                type: notificationType,
                deliveryMethod: deliveryMethod,
                customTitle: notificationType === 'CUSTOM' ? customTitle : undefined,
                customSubject: notificationType === 'CUSTOM' ? customSubject : undefined,
                customMessage: notificationType === 'CUSTOM' ? customMessage : undefined,
            }

            const res = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                toast.success(`Successfully sent notifications to ${selectedIds.size} staff member(s)`)
                setSelectedIds(new Set())
                setConfirmOpen(false)
                setCustomTitle("")
                setCustomSubject("")
                setCustomMessage("")
                fetchLogs() // refresh logs after sending
            } else {
                const data = await res.json()
                toast.error(data.error || "Failed to send notifications")
            }
        } catch (e) {
            toast.error("An unexpected error occurred.")
        } finally {
            setIsSending(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-sm overflow-hidden animate-bounce p-2">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading User Directory...</p>
            </div>
        )
    }

    const getPreviewMessage = () => {
        switch (notificationType) {
            case "LATE_ARRIVAL": return "We noticed you haven't clocked in yet. Please clock in when ready."
            case "OVERDUE_DEPARTURE": return "Your shift has ended, but you're still clocked in. Please clock out."
            case "FORGOTTEN_CLOCKOUT": return "You may have forgotten to clock out recently. Please verify your log."
            case "BREAK_RETURN": return "You have reached your limit. Please end your break and get back to work."
            case "CUSTOM": return customMessage || "Your custom message here..."
            default: return "Select a template."
        }
    }

    return (
        <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-10 px-4 lg:px-8">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Message Center</h1>
                <p className="text-muted-foreground text-sm">Send standard alerts directly to staff members or view application notification history.</p>
            </div>

            <Tabs defaultValue="send" className="w-full" onValueChange={(val) => { if (val === 'history') fetchLogs() }}>
                <TabsList className="grid w-full sm:w-[400px] grid-cols-2 mb-6 bg-slate-100">
                    <TabsTrigger value="send" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200">
                        <Send className="w-4 h-4 mr-2 opacity-70" /> Send Messages
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200">
                        <Clock className="w-4 h-4 mr-2 opacity-70" /> Notification History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="send" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">

                        {/* Selection Table Panel */}
                        <Card className="lg:col-span-2 border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                            <CardHeader className="border-b border-border p-6 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <CardTitle className="text-lg">Staff Selection</CardTitle>
                                    <div className="relative max-w-sm w-full">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search staff..."
                                            className="pl-9 h-9 w-full bg-white font-medium text-sm rounded-lg"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            {selectedIds.size > 0 && (
                                <div className="bg-primary/5 border-b border-primary/10 p-3 flex items-center justify-between animate-in slide-in-from-top-2">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="text-primary h-5 w-5" />
                                        <span className="text-sm font-bold text-primary">{selectedIds.size} selected</span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-muted-foreground h-8 text-xs">
                                        Clear Selection
                                    </Button>
                                </div>
                            )}
                            <CardContent className="p-0 border-b border-border max-h-[500px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                        <TableRow className="border-border hover:bg-transparent">
                                            <TableHead className="w-[50px] pl-6 py-3">
                                                <Checkbox
                                                    checked={filteredEmployees.length > 0 && selectedIds.size === filteredEmployees.length}
                                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                                />
                                            </TableHead>
                                            <TableHead className="py-3 px-6 font-medium text-muted-foreground text-xs uppercase tracking-wider">Employee</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredEmployees.map((emp) => (
                                            <TableRow key={emp.id} className={selectedIds.has(emp.id) ? "bg-primary/5 border-primary/20 hover:bg-primary/10 cursor-pointer" : "border-border hover:bg-muted/30 transition-colors cursor-pointer"} onClick={() => handleSelectOne(emp.id, !selectedIds.has(emp.id))}>
                                                <TableCell className="pl-6 py-3">
                                                    <Checkbox
                                                        checked={selectedIds.has(emp.id)}
                                                        onCheckedChange={(checked) => handleSelectOne(emp.id, !!checked)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </TableCell>
                                                <TableCell className="py-3 px-6">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-foreground text-sm flex items-center gap-2">
                                                            {emp.name || "Unknown Identity"}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                            <Mail className="h-3 w-3 opacity-70" />
                                                            {emp.email}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredEmployees.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center py-10">
                                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                        <User className="h-6 w-6 opacity-30" />
                                                        <p className="text-xs">No active staff members found</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Dispatch Panel */}
                        <Card className="border border-border shadow-sm rounded-xl bg-white h-fit sticky top-24">
                            <CardHeader className="border-b border-border p-6">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <ShieldAlert className="h-5 w-5 text-amber-600" /> Send Message
                                </CardTitle>
                                <CardDescription>Choose a predefined template or write your own message to send instantly.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-3">
                                    <Label className="font-bold">Message Template</Label>
                                    <Select value={notificationType} onValueChange={setNotificationType}>
                                        <SelectTrigger className="w-full bg-slate-50">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LATE_ARRIVAL">Clock In Reminder</SelectItem>
                                            <SelectItem value="OVERDUE_DEPARTURE">Clock Out Reminder</SelectItem>
                                            <SelectItem value="FORGOTTEN_CLOCKOUT">Forgot Clock Out Notice</SelectItem>
                                            <SelectItem value="BREAK_RETURN">Break Return Notice</SelectItem>
                                            <SelectItem value="CUSTOM">Custom Message</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-3">
                                    <Label className="font-bold">Delivery Method</Label>
                                    <Select value={deliveryMethod} onValueChange={(val: any) => setDeliveryMethod(val)}>
                                        <SelectTrigger className="w-full bg-slate-50">
                                            <SelectValue placeholder="Select delivery method" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="BOTH">In-App & Email</SelectItem>
                                            <SelectItem value="IN_APP">In-App Only</SelectItem>
                                            <SelectItem value="EMAIL">Email Only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {notificationType === "CUSTOM" && (
                                    <div className="space-y-4 animate-in slide-in-from-top-2">
                                        <div className="space-y-2">
                                            <Label className={deliveryMethod === 'IN_APP' ? "text-muted-foreground" : ""}>Custom Subject (Email)</Label>
                                            <Input
                                                value={customSubject}
                                                onChange={e => setCustomSubject(e.target.value)}
                                                placeholder="[RSA] Important Update"
                                                disabled={deliveryMethod === 'IN_APP'}
                                                className={deliveryMethod === 'IN_APP' ? "bg-slate-50 cursor-not-allowed" : ""}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className={deliveryMethod === 'EMAIL' ? "text-muted-foreground" : ""}>Custom Title (App)</Label>
                                            <Input
                                                value={customTitle}
                                                onChange={e => setCustomTitle(e.target.value)}
                                                placeholder="Important Update"
                                                disabled={deliveryMethod === 'EMAIL'}
                                                className={deliveryMethod === 'EMAIL' ? "bg-slate-50 cursor-not-allowed" : ""}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Custom Message Body</Label>
                                            <textarea
                                                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                                placeholder="Enter the main body content..."
                                                value={customMessage}
                                                onChange={e => setCustomMessage(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Message Preview</Label>
                                    <p className="text-sm italic text-slate-600">"{getPreviewMessage()}"</p>
                                </div>

                                <Button
                                    className="w-full font-bold h-12 gap-2 text-[15px]"
                                    disabled={selectedIds.size === 0 || (notificationType === 'CUSTOM' && !customMessage.trim())}
                                    onClick={() => setConfirmOpen(true)}
                                >
                                    <Send className="h-4 w-4" />
                                    Send to {selectedIds.size} Staff Member(s)
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Confirmation Dialog */}
                    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                        <DialogContent className="sm:max-w-[400px]">
                            <DialogHeader>
                                <DialogTitle>Confirm Action</DialogTitle>
                                <DialogDescription>
                                    Are you sure you want to send this message to {selectedIds.size} staff member{selectedIds.size > 1 ? 's' : ''}?
                                    {deliveryMethod === 'BOTH' && " They will receive it immediately via email and in the app."}
                                    {deliveryMethod === 'IN_APP' && " They will receive it immediately inside the application only."}
                                    {deliveryMethod === 'EMAIL' && " They will receive it via their registered email address only."}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex gap-3 justify-end mt-4">
                                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                                <Button
                                    variant="default"
                                    className="gap-2"
                                    onClick={handleSendNotification}
                                    disabled={isSending}
                                >
                                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    {isSending ? 'Sending...' : 'Confirm & Send'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                </TabsContent>
                <TabsContent value="history" className="mt-0">
                    <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white animate-in zoom-in-95 duration-300">
                        <CardHeader className="border-b border-border p-6 bg-slate-50/50">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="h-5 w-5 text-slate-500" /> Recent Application Notifications
                            </CardTitle>
                            <CardDescription>A system-wide chronological log of recent in-app and email alerts sent to users.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 border-b border-border max-h-[600px] overflow-y-auto">
                            {loadingLogs ? (
                                <div className="p-12 flex justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <Clock className="h-8 w-8 opacity-20 mx-auto mb-3" />
                                    <p className="text-sm">No notification history recorded yet.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                        <TableRow className="border-border hover:bg-transparent">
                                            <TableHead className="py-3 px-6 font-medium text-muted-foreground text-xs uppercase tracking-wider">Timestamp</TableHead>
                                            <TableHead className="py-3 px-6 font-medium text-muted-foreground text-xs uppercase tracking-wider">Recipient</TableHead>
                                            <TableHead className="py-3 px-6 font-medium text-muted-foreground text-xs uppercase tracking-wider">Category</TableHead>
                                            <TableHead className="py-3 px-6 font-medium text-muted-foreground text-xs uppercase tracking-wider">Title / Subject</TableHead>
                                            <TableHead className="py-3 px-6 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Snippet</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => (
                                            <TableRow key={log.id} className="border-border hover:bg-muted/30 transition-colors">
                                                <TableCell className="py-3 px-6 whitespace-nowrap">
                                                    <span className="text-xs font-semibold text-slate-600 block">
                                                        {new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-3 px-6">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-foreground text-sm flex items-center gap-2">
                                                            {log.user?.name || "Unknown"}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground mt-0.5">
                                                            {log.user?.email || "No email"}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3 px-6">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700">
                                                        {log.type}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-3 px-6 text-sm font-medium">
                                                    {(log.title || 'Notification').replace(/^\[RSA\]\s*/i, '')}
                                                </TableCell>
                                                <TableCell className="py-3 px-6 text-xs text-slate-500 max-w-[250px] truncate hidden md:table-cell" title={log.message}>
                                                    {log.message}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
