'use client'

import { useState } from 'react'
import { Calendar, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface CalendarSyncStatus {
    synced: boolean
    appStatus?: string
    calendarLocation?: {
        type: string
        label: string | null
        summary: string | null
    } | null
    hasCalendarEvent?: boolean
    message?: string
}

export function CalendarSyncWidget() {
    const [syncStatus, setSyncStatus] = useState<CalendarSyncStatus | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)

    const checkSyncStatus = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/calendar/sync')
            const data = await response.json()
            setSyncStatus(data)
        } catch (error) {
            console.error('Failed to check sync status:', error)
            toast.error("Failed to check Google Calendar sync status")
        } finally {
            setIsLoading(false)
        }
    }

    const syncFromCalendar = async () => {
        setIsSyncing(true)
        try {
            const response = await fetch('/api/calendar/sync', {
                method: 'POST'
            })
            const data = await response.json()

            if (data.success) {
                toast.success(data.message || "Status synced from Google Calendar")
                // Refresh status
                await checkSyncStatus()
                // Reload page to update UI
                window.location.reload()
            } else {
                toast.error(data.message || "Failed to sync from Google Calendar")
            }
        } catch (error) {
            console.error('Failed to sync from calendar:', error)
            toast.error("Failed to sync from Google Calendar")
        } finally {
            setIsSyncing(false)
        }
    }

    const getStatusBadge = () => {
        if (!syncStatus) return null

        if (!syncStatus.synced) {
            return (
                <Badge variant="outline" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Not Connected
                </Badge>
            )
        }

        if (syncStatus.hasCalendarEvent) {
            return (
                <Badge variant="default" className="gap-1 bg-green-500">
                    <CheckCircle2 className="h-3 w-3" />
                    Synced
                </Badge>
            )
        }

        return (
            <Badge variant="outline" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                No Calendar Event
            </Badge>
        )
    }

    return (
        <Card className="border-dashed">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Google Calendar Sync</CardTitle>
                    </div>
                    {getStatusBadge()}
                </div>
                <CardDescription className="text-xs">
                    Your availability status syncs with Google Calendar working location
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {syncStatus && syncStatus.calendarLocation && (
                    <div className="rounded-lg bg-muted p-3 text-sm">
                        <div className="font-medium text-foreground mb-1">
                            📍 {syncStatus.calendarLocation.summary || syncStatus.calendarLocation.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Type: {syncStatus.calendarLocation.type}
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={checkSyncStatus}
                        disabled={isLoading}
                        className="flex-1"
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="mr-2 h-3 w-3" />
                                Check Status
                            </>
                        )}
                    </Button>

                    <Button
                        size="sm"
                        onClick={syncFromCalendar}
                        disabled={isSyncing}
                        className="flex-1"
                    >
                        {isSyncing ? (
                            <>
                                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                                Syncing...
                            </>
                        ) : (
                            <>
                                <Calendar className="mr-2 h-3 w-3" />
                                Sync Now
                            </>
                        )}
                    </Button>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Clock in/out automatically updates Google Calendar</p>
                    <p>• Manual status changes sync to Calendar</p>
                    <p>• Click "Sync Now" to import from Calendar</p>
                </div>
            </CardContent>
        </Card>
    )
}
