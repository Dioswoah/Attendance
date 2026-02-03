"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    History,
    Key,
    Globe,
    Fingerprint,
    Cpu,
    FileQuestion,
    ArrowLeft,
    AlertTriangle,
    Mail,
    RefreshCcw,
    Save,
    Settings as SettingsIcon,
    Lock,
    Bell,
    Palette,
    Database,
    Flame,
    Shield
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export default function SettingsPage() {
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('General Configuration')
    const [notImplemented, setNotImplemented] = useState<{ title: string; desc: string } | null>(null)

    const handleSave = () => {
        setSaving(true)
        setTimeout(() => setSaving(false), 1500)
    }

    const triggerNotImplemented = (title: string, desc: string) => {
        setNotImplemented({ title, desc })
    }

    const tabs = [
        { label: 'General Configuration', icon: SettingsIcon },
        { label: 'Security & Access', icon: Lock },
        { label: 'Notifications', icon: Bell },
        { label: 'Branding & Theme', icon: Palette },
        { label: 'Data Management', icon: Database },
        { label: 'Audit Records', icon: History },
    ]

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10 max-w-[1600px] mx-auto px-4 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Settings</h1>
                    <p className="text-muted-foreground text-sm">System Configuration & Global Parameters</p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full md:w-auto"
                >
                    {saving ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    {saving ? "Saving Changes..." : "Apply Configuration"}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Navigation Sidebar (UI Only) */}
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                        <CardContent className="p-2 space-y-1">
                            {tabs.map(item => (
                                <button
                                    key={item.label}
                                    onClick={() => setActiveTab(item.label)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === item.label
                                        ? "bg-muted text-foreground font-semibold"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                        }`}
                                >
                                    <item.icon className={`h-4 w-4 ${activeTab === item.label ? "text-primary" : "text-muted-foreground"}`} />
                                    {item.label}
                                </button>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border border-border shadow-sm rounded-xl bg-slate-900 p-6 text-white relative overflow-hidden">
                        <Flame className="absolute -bottom-4 -right-4 h-24 w-24 text-red-600/20 rotate-12" />
                        <div className="relative z-10 space-y-3">
                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest">System Information</p>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold">Redadair Enterprise v4.2.0</p>
                                <p className="text-xs text-slate-400">Build ID: RED-2026-ALPHA</p>
                            </div>
                            <div className="pt-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                                    CORE STABLE
                                </span>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-3 space-y-6">
                    {activeTab === 'General Configuration' && (
                        <>
                            {/* Organization Settings */}
                            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                                <CardHeader className="p-6 border-b border-border bg-muted/20">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                            <Shield className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div className="space-y-1">
                                            <CardTitle className="text-lg font-semibold text-foreground">Organization Profile</CardTitle>
                                            <CardDescription className="text-sm text-muted-foreground">Identity parameters for the attendance network</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>Enterprise Name</Label>
                                            <Input defaultValue="Redadair Fire Protection" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Support Contact</Label>
                                            <Input defaultValue="admin@redadair.com" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>System Language</Label>
                                            <Input defaultValue="English (AU)" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Timezone / Regional</Label>
                                            <Input defaultValue="GMT+8 (Manila/Perth)" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Operational Toggles */}
                            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                                <CardHeader className="p-6 border-b border-border bg-muted/20">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                            <Database className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div className="space-y-1">
                                            <CardTitle className="text-lg font-semibold text-foreground">Operational Toggles</CardTitle>
                                            <CardDescription className="text-sm text-muted-foreground">Automated logic and system behavior</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-white hover:bg-muted/20 transition-all">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-foreground">Automated Audit Generation</p>
                                            <p className="text-xs text-muted-foreground">Generate daily attendance logs at midnight</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-white hover:bg-muted/20 transition-all">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-foreground">E-mail Notifications</p>
                                            <p className="text-xs text-muted-foreground">Send summary reports to department heads</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {activeTab === 'Security & Access' && (
                        <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                            <CardHeader className="p-6 border-b border-border bg-muted/20">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                        <Lock className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg font-semibold text-foreground">Security Protocols</CardTitle>
                                        <CardDescription className="text-sm text-muted-foreground">Access control and hardware integration</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-white hover:bg-muted/20 transition-all">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-foreground">API Endpoint Exposure</p>
                                        <p className="text-xs text-muted-foreground">Allow external nodes to interface with data</p>
                                    </div>
                                    <Switch onCheckedChange={() => triggerNotImplemented('API Exposure', 'allowing external nodes to interface with data')} />
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-white hover:bg-muted/20 transition-all">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-foreground">Biometric Integration</p>
                                        <p className="text-xs text-muted-foreground">Enable advanced verification via hardware</p>
                                    </div>
                                    <Switch onCheckedChange={() => triggerNotImplemented('Biometric Integration', 'advanced verification via hardware')} />
                                </div>
                                <div className="space-y-2 pt-4">
                                    <Label>Admin Password Policy</Label>
                                    <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground border border-border">
                                        Current Policy: Minimum 12 characters, Alpha-Numeric, Required Symbol.
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'Notifications' && (
                        <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                            <CardHeader className="p-6 border-b border-border bg-muted/20">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                        <Bell className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg font-semibold text-foreground">Notification Channels</CardTitle>
                                        <CardDescription className="text-sm text-muted-foreground">Configuring alert pathways for staff & admins</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label>Email Alerts</Label>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>Push Notifications</Label>
                                        <Switch onCheckedChange={() => triggerNotImplemented('Push Notifications', 'real-time device alerts')} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>Slack Integration</Label>
                                        <Switch onCheckedChange={() => triggerNotImplemented('Slack Integration', 'automated channel updates')} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {(activeTab === 'Branding & Theme' || activeTab === 'Data Management' || activeTab === 'Audit Records') && (
                        <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                            <CardContent className="flex flex-col items-center justify-center p-20 text-center space-y-6">
                                <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
                                    <Cpu className="h-10 w-10 text-muted-foreground animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-foreground">{activeTab} Interface</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                        This structural module is currently under construction for the Redadair Enterprise 2026 upgrade.
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setActiveTab('General Configuration')}>
                                    Return to Overview
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* NotImplemented Dialog (404 style) */}
            <Dialog open={!!notImplemented} onOpenChange={(open) => !open && setNotImplemented(null)}>
                <DialogContent className="sm:max-w-md border-none p-0 bg-transparent shadow-none outline-none">
                    <Card className="border border-border shadow-2xl rounded-2xl overflow-hidden bg-white">
                        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
                            <DialogHeader className="sr-only">
                                <DialogTitle>{notImplemented?.title} Not Found</DialogTitle>
                                <DialogDescription>Feature not yet implemented</DialogDescription>
                            </DialogHeader>

                            <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center mb-2 animate-bounce">
                                <div className="relative">
                                    <Flame className="h-10 w-10 text-red-600" />
                                    <FileQuestion className="h-5 w-5 text-red-600 absolute -bottom-1 -right-1 fill-white outline-4 outline-white" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">{notImplemented?.title} Not Found</h1>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                    The module for <span className="font-semibold text-foreground text-red-600 uppercase italic">"{notImplemented?.desc}"</span> has not yet been deployed to the active sector.
                                </p>
                            </div>

                            <div className="w-full pt-4">
                                <Button onClick={() => setNotImplemented(null)} className="w-full gap-2 font-medium bg-slate-900 hover:bg-slate-800">
                                    Acknowledged
                                </Button>
                            </div>

                            <p className="text-[10px] uppercase font-bold text-muted-foreground/30 pt-2 tracking-widest">
                                Status: 404_FEATURE_NOT_DEPLOYED
                            </p>
                        </CardContent>
                    </Card>
                </DialogContent>
            </Dialog>
        </div>
    )
}
