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
                <Loader2 className="h-10 w-10 animate-spin text-red-600" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Notification Directory...</p>
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
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Manual Notifications</h1>
                <p className="text-muted-foreground text-sm">Send standard alerts or custom messages to specific staff members</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

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
                                <span className="text-sm font-bold text-primary">{selectedIds.size} staff member(s) selected</span>
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
                            <ShieldAlert className="h-5 w-5 text-amber-600" /> Dispatch Control
                        </CardTitle>
                        <CardDescription>Select the template and trigger an immediate In-App + Email push notification.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-3">
                            <Label className="font-bold">Notification Template</Label>
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

                        {notificationType === "CUSTOM" && (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label>Custom Subject (Email)</Label>
                                    <Input value={customSubject} onChange={e => setCustomSubject(e.target.value)} placeholder="[RSA] Important Update" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Custom Title (App)</Label>
                                    <Input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Important Update" />
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
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Preview Snippet</Label>
                            <p className="text-sm italic text-slate-600">"{getPreviewMessage()}"</p>
                        </div>

                        <Button
                            className="w-full font-bold h-12 gap-2 text-[15px]"
                            disabled={selectedIds.size === 0}
                            onClick={() => setConfirmOpen(true)}
                        >
                            <Send className="h-4 w-4" />
                            Dispatch to {selectedIds.size} User(s)
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Confirmation Dialog */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Confirm Notification Push</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to push this {notificationType === 'CUSTOM' ? 'custom' : 'automated'} notification immediately to {selectedIds.size} staff members?
                            This will trigger both an email broadcast and a direct in-app alert.
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
                            {isSending ? 'Sending...' : 'Confirm Payload'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}
