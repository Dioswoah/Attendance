"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Settings as SettingsIcon,
    Shield,
    Bell,
    Palette,
    Database,
    Lock,
    UserCircle,
    Save,
    RefreshCcw,
    Flame,
    Smartphone,
    Languages,
    History
} from "lucide-react"

export default function SettingsPage() {
    const [saving, setSaving] = useState(false)

    const handleSave = () => {
        setSaving(true)
        setTimeout(() => setSaving(false), 1500)
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Navigation Sidebar (UI Only) */}
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                        <CardContent className="p-2 space-y-1">
                            {[
                                { label: 'General Configuration', icon: SettingsIcon, active: true },
                                { label: 'Security & Access', icon: Lock },
                                { label: 'Notifications', icon: Bell },
                                { label: 'Branding & Theme', icon: Palette },
                                { label: 'Data Management', icon: Database },
                                { label: 'Audit Records', icon: History },
                            ].map(item => (
                                <button
                                    key={item.label}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${item.active
                                        ? "bg-muted text-foreground font-semibold"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                        }`}
                                >
                                    <item.icon className={`h-4 w-4 ${item.active ? "text-primary" : "text-muted-foreground"}`} />
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

                {/* Settings Fields */}
                <div className="lg:col-span-3 space-y-8">
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
                            {[
                                { title: "Automated Audit Generation", desc: "Generate daily attendance logs at midnight", active: true },
                                { title: "E-mail Notifications", desc: "Send summary reports to department heads", active: true },
                                { title: "API Endpoint Exposure", desc: "Allow external nodes to interface with data", active: false },
                                { title: "Biometric Integration", desc: "Enable advanced verification protocols", active: false },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border bg-white hover:bg-muted/20 transition-all">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                                    </div>
                                    <Switch defaultChecked={item.active} />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
