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
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase leading-none">Settings</h1>
                    <p className="text-red-600 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">System Configuration & Global Parameters</p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-14 px-10 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95 italic uppercase tracking-widest gap-3"
                >
                    {saving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Saving Changes..." : "Apply Configuration"}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Navigation Sidebar (UI Only) */}
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-none shadow-sm rounded-3xl bg-white border border-slate-100 p-4">
                        <div className="space-y-1">
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
                                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest italic transition-all ${item.active
                                            ? "bg-red-50 text-red-600 shadow-sm"
                                            : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                                        }`}
                                >
                                    <item.icon className={`h-4 w-4 ${item.active ? "text-red-600" : "text-slate-300"}`} />
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </Card>

                    <Card className="border-none shadow-sm rounded-3xl bg-slate-900 p-6 text-white relative overflow-hidden">
                        <Flame className="absolute -bottom-4 -right-4 h-24 w-24 text-red-600/20 rotate-12" />
                        <div className="relative z-10 space-y-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">System Information</p>
                            <div className="space-y-1">
                                <p className="text-xs font-black italic">Redadair Enterprise v4.2.0</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Build ID: RED-2026-ALPHA</p>
                            </div>
                            <div className="pt-2">
                                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[7px] font-black uppercase tracking-tighter">
                                    CORE STABLE
                                </Badge>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Settings Fields */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Organization Settings */}
                    <Card className="border-none shadow-sm rounded-[2.5rem] bg-white border border-slate-100 p-10">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center">
                                <Shield className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic">Organization Profile</h2>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Identity parameters for the attendance network</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Enterprise Name</Label>
                                <Input defaultValue="Redadair Fire Protection" className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase italic text-slate-800" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Support Contact</Label>
                                <Input defaultValue="admin@redadair.com" className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] italic text-slate-800" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">System Language</Label>
                                <Input defaultValue="English (AU)" className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase italic text-slate-800" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Timezone / Regional</Label>
                                <Input defaultValue="GMT+8 (Manila/Perth)" className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase italic text-slate-800" />
                            </div>
                        </div>
                    </Card>

                    {/* Operational Toggles */}
                    <Card className="border-none shadow-sm rounded-[2.5rem] bg-white border border-slate-100 p-10">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center">
                                <Database className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic">Operational Toggles</h2>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Automated logic and system behavior</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {[
                                { title: "Automated Audit Generation", desc: "Generate daily attendance logs at midnight", active: true },
                                { title: "E-mail Notifications", desc: "Send summary reports to department heads", active: true },
                                { title: "API Endpoint Exposure", desc: "Allow external nodes to interface with data", active: false },
                                { title: "Biometric Integration", desc: "Enable advanced verification protocols", active: false },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase italic text-slate-800">{item.title}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.desc}</p>
                                    </div>
                                    <Switch defaultChecked={item.active} className="data-[state=checked]:bg-red-600" />
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function Badge({ children, className, variant }: { children: React.ReactNode, className?: string, variant?: string }) {
    return (
        <span className={`px-2 py-0.5 rounded-md ${className}`}>
            {children}
        </span>
    )
}
