"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, ShieldCheck, Loader2, ArrowLeft } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function AdminLoginPage() {
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        // Default password fallback
        const DEFAULT_PASSWORD = "RedadairAdmin2024"

        try {
            const res = await fetch('/api/auth/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            })

            const data = await res.json()

            if (res.ok && data.success) {
                sessionStorage.setItem("adminAuthenticated", "true")
                router.push("/admin")
                return
            } else if (res.status === 500) {
                if (password === DEFAULT_PASSWORD) {
                    sessionStorage.setItem("adminAuthenticated", "true")
                    router.push("/admin")
                    return
                }
            }
            setError(data.error || "Access Denied. Incorrect Credential.")
        } catch (err) {
            if (password === DEFAULT_PASSWORD) {
                sessionStorage.setItem("adminAuthenticated", "true")
                router.push("/admin")
                return
            }
            setError("Connection failed. Systems offline.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 h-96 w-96 bg-red-100 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 opacity-30" />
            <div className="absolute bottom-0 left-0 h-96 w-96 bg-yellow-50 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 opacity-30" />

            <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-700">
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="h-16 w-16 bg-red-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-red-100 mb-2 group active:scale-95 transition-transform cursor-pointer">
                        <ShieldCheck className="h-8 w-8 text-white group-hover:rotate-12 transition-all" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">Security Access</h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Restricted Administration Node</p>
                    </div>
                </div>

                <Card className="border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-md">
                    <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100 text-center">
                        <CardDescription className="font-bold text-slate-500 text-xs uppercase tracking-widest">Identify yourself to proceed</CardDescription>
                    </CardHeader>
                    <CardContent className="p-10">
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Admin Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        type="password"
                                        placeholder="••••••••••••"
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value)
                                            setError("")
                                        }}
                                        className={`h-14 pl-12 rounded-2xl border-2 transition-all font-black tracking-widest ${error ? "border-red-100 bg-red-50 text-red-900" : "border-slate-50 bg-slate-50/50 text-slate-900 focus:border-red-500"
                                            }`}
                                    />
                                </div>
                                {error && (
                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-1 animate-in slide-in-from-top-1">
                                        {error}
                                    </p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-16 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-100 transition-all active:scale-95 italic uppercase tracking-widest"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Authorize Access"}
                            </Button>
                        </form>

                        <div className="mt-10 pt-8 border-t border-slate-100 flex justify-center">
                            <Link href="/user">
                                <Button variant="ghost" className="h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-red-600 transition-colors gap-2">
                                    <ArrowLeft className="h-3 w-3" /> Back to Staff Portal
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">Redadair Fire Group • System v0.1</p>
            </div>
        </div>
    )
}
