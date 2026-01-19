"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Search, Check, X, Calendar, Clock, AlertCircle, Loader2 } from "lucide-react"
import { format } from "date-fns"

interface PendingRequest {
    id: string
    userId: string
    userName: string
    userImage?: string
    department?: string
    type: string
    duration: string
    startDate: string
    endDate: string
    startTime?: string
    endTime?: string
    reason: string
    status: string
    createdAt: string
}

export default function ManagerControlPage() {
    const { data: session, status } = useSession()
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null)
    const [actionType, setActionType] = useState<"approve" | "deny" | null>(null)
    const [denyReason, setDenyReason] = useState("")
    const [denyReasonError, setDenyReasonError] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (session?.user?.id) {
            fetchPendingRequests()
        }
    }, [session])

    const fetchPendingRequests = async () => {
        if (!session?.user?.id) return
        setIsLoading(true)
        try {
            const res = await fetch(`/api/leaves?managerId=${session.user.id}&status=PENDING`)
            if (res.ok) {
                const data = await res.json()
                setPendingRequests(data)
            }
        } catch (error) {
            console.error("Failed to fetch pending requests:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAction = (request: PendingRequest, action: "approve" | "deny") => {
        setSelectedRequest(request)
        setActionType(action)
        setDenyReason("")
        setDenyReasonError(false)
    }

    const confirmAction = async () => {
        if (actionType === "deny" && !denyReason.trim()) {
            setDenyReasonError(true)
            return
        }

        if (!selectedRequest) return

        setIsSubmitting(true)
        try {
            const body: any = { status: actionType === "approve" ? "APPROVED" : "DECLINED" }
            if (actionType === "deny" && denyReason) {
                body.declineReason = denyReason
            }

            const res = await fetch(`/api/leaves/${selectedRequest.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                setPendingRequests(pendingRequests.filter((r) => r.id !== selectedRequest.id))
                setSelectedRequest(null)
                setActionType(null)
                setDenyReason("")
                setDenyReasonError(false)
            } else {
                const data = await res.json()
                alert(data.error || "Failed to update leave request")
            }
        } catch (error) {
            console.error("Failed to update leave request:", error)
            alert("An error occurred while processing the request")
        } finally {
            setIsSubmitting(false)
        }
    }

    const filteredRequests = pendingRequests.filter(
        (request) =>
            request.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            request.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (request.department && request.department.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    if (status === "loading" || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Manager Control</h1>
                <p className="text-base text-muted-foreground mt-1">Review and manage team leave requests</p>
            </div>

            {/* Pending Requests Section */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                        <h2 className="text-lg font-semibold text-foreground">Pending Requests</h2>
                        {pendingRequests.length > 0 && (
                            <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100/80 border-yellow-200 h-6 px-2 flex items-center justify-center text-xs font-semibold">
                                {pendingRequests.length}
                            </Badge>
                        )}
                    </div>
                    {/* Search */}
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search requests..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-10 bg-white border-border rounded-lg text-sm"
                        />
                    </div>
                </div>

                {/* Requests List */}
                <div className="space-y-4">
                    {filteredRequests.map((request) => (
                        <Card key={request.id} className="border border-border shadow-sm rounded-xl overflow-hidden bg-white hover:bg-muted/30 transition-colors">
                            <CardContent className="p-6">
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                                    <div className="flex gap-4 w-full">
                                        <div className="h-12 w-12 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-semibold text-sm shadow-sm shrink-0">
                                            {request.userImage ? (
                                                <img src={request.userImage} className="w-full h-full rounded-full object-cover" alt={request.userName} />
                                            ) : (
                                                getInitials(request.userName)
                                            )}
                                        </div>
                                        <div className="space-y-3 flex-1">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div>
                                                    <h3 className="text-base font-semibold text-foreground">{request.userName}</h3>
                                                    <p className="text-sm text-muted-foreground">{request.department || "Unassigned"}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Badge variant="outline" className="font-normal text-xs bg-muted/50 border-border text-muted-foreground capitalize">
                                                        {request.type.toLowerCase().replace('_', ' ')}
                                                    </Badge>
                                                    <Badge variant="outline" className="font-normal text-xs bg-muted/50 border-border text-muted-foreground">
                                                        {request.duration}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-primary/70" />
                                                    <span className="font-medium text-foreground">
                                                        {format(new Date(request.startDate), 'MMM dd')} - {format(new Date(request.endDate), 'MMM dd')}
                                                    </span>
                                                </span>
                                                {request.startTime && request.endTime && (
                                                    <span className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-primary/70" />
                                                        <span className="font-medium text-foreground">
                                                            {format(new Date(request.startTime), 'h:mm a')} - {format(new Date(request.endTime), 'h:mm a')}
                                                        </span>
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-2 text-xs">
                                                    <span>Submitted:</span>
                                                    {format(new Date(request.createdAt), 'MMM dd, yyyy')}
                                                </span>
                                            </div>

                                            <div className="bg-muted/30 p-3 rounded-lg border border-border/50 max-w-3xl">
                                                <p className="text-sm text-foreground italic">"{request.reason}"</p>
                                            </div>

                                            {/* Action Buttons inside the card for mobile, or simpler layout */}
                                            <div className="flex gap-3 pt-2">
                                                <Button
                                                    onClick={() => handleAction(request, "approve")}
                                                    size="sm"
                                                    className="gap-2 bg-green-600 hover:bg-green-700 text-white font-medium h-9"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    Approve
                                                </Button>
                                                <Button
                                                    onClick={() => handleAction(request, "deny")}
                                                    size="sm"
                                                    variant="destructive"
                                                    className="gap-2 font-medium h-9"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Deny
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {filteredRequests.length === 0 && (
                        <Card className="border border-border shadow-sm rounded-xl bg-white">
                            <CardContent className="p-12 text-center">
                                <Check className="w-12 h-12 text-primary/20 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-foreground">All caught up!</h3>
                                <p className="text-sm text-muted-foreground mt-1">No pending leave requests to review.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Confirmation Dialog */}
            <Dialog
                open={!!selectedRequest}
                onOpenChange={() => {
                    setSelectedRequest(null)
                    setActionType(null)
                    setDenyReason("")
                    setDenyReasonError(false)
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {actionType === "approve" ? "Approve Request" : "Deny Request"}
                        </DialogTitle>
                        <DialogDescription>
                            {actionType === "approve"
                                ? `Confirm approval for ${selectedRequest?.userName}'s leave request`
                                : `Provide a reason for denying ${selectedRequest?.userName}'s request`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Request Summary */}
                        {selectedRequest && (
                            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
                                <p className="text-sm font-medium text-foreground">
                                    {selectedRequest.type} • {selectedRequest.duration}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {format(new Date(selectedRequest.startDate), 'MMM dd, yyyy')} - {format(new Date(selectedRequest.endDate), 'MMM dd, yyyy')}
                                </p>
                            </div>
                        )}

                        {actionType === "deny" && (
                            <div className="space-y-2">
                                <Label htmlFor="denyReason">
                                    Reason for Denial <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    id="denyReason"
                                    value={denyReason}
                                    onChange={(e) => {
                                        setDenyReason(e.target.value)
                                        setDenyReasonError(false)
                                    }}
                                    placeholder="Please provide a reason..."
                                    className={`min-h-[100px] resize-none ${denyReasonError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                />
                                {denyReasonError && (
                                    <p className="text-xs font-medium text-red-500">Please provide a reason for the denial.</p>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedRequest(null)
                                setActionType(null)
                                setDenyReason("")
                                setDenyReasonError(false)
                            }}
                            disabled={isSubmitting}
                            className="h-9"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmAction}
                            disabled={isSubmitting}
                            variant={actionType === "approve" ? "default" : "destructive"}
                            className={`h-9 ${actionType === "approve" ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            {actionType === "approve" ? "Confirm Approval" : "Confirm Denial"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
