"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export default function SettingsPage() {
    const [allowManualClockIn, setAllowManualClockIn] = useState(false)
    const [requireLocationAccess, setRequireLocationAccess] = useState(false)
    const [companyName, setCompanyName] = useState("Redadair Group")
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('appSettings')
        if (savedSettings) {
            const settings = JSON.parse(savedSettings)
            setAllowManualClockIn(settings.allowManualClockIn || false)
            setRequireLocationAccess(settings.requireLocationAccess || false)
            setCompanyName(settings.companyName || "Redadair Group")
        }
    }, [])

    const handleSave = () => {
        setSaving(true)
        const settings = {
            allowManualClockIn,
            requireLocationAccess,
            companyName
        }
        localStorage.setItem('appSettings', JSON.stringify(settings))

        setTimeout(() => {
            setSaving(false)
            alert('Settings saved successfully!')
        }, 500)
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage system preferences and configurations.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>Configure basic system behavior.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Allow Manual Clock In</Label>
                            <p className="text-sm text-muted-foreground">
                                Allow employees to manually edit their clock in times.
                            </p>
                        </div>
                        <Switch
                            checked={allowManualClockIn}
                            onCheckedChange={setAllowManualClockIn}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Require Location Access</Label>
                            <p className="text-sm text-muted-foreground">
                                Force GPS location for mobile clock ins.
                            </p>
                        </div>
                        <Switch
                            checked={requireLocationAccess}
                            onCheckedChange={setRequireLocationAccess}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Company Information</CardTitle>
                    <CardDescription>Update company details for reports.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                            id="companyName"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Enter company name"
                        />
                    </div>

                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
