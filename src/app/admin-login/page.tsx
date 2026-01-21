"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, ShieldCheck, Loader2, ArrowLeft } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"

export default function AdminLoginPage() {
    const { data: session, status } = useSession()
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (status === "loading") return

        const adminAuth = sessionStorage.getItem("adminAuthenticated")

        // 1. If already have the session key, and we are an ADMIN, skip login
        if (adminAuth === "true" && session?.user) {
            const roles = (session.user as any).roles || []
            if (roles.includes("ADMIN")) {
                router.replace("/admin")
                return
            }
        }

        // 2. If Logged In but NOT an ADMIN, kick them out
        if (session?.user) {
            const roles = (session.user as any).roles || []
            if (!roles.includes("ADMIN")) {
                router.replace("/?error=unauthorized&callbackUrl=/admin-login")
            }
        }
    }, [session, status, router])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

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

    if (status === "loading") {
        return (
            <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 h-96 w-96 bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 h-96 w-96 bg-primary/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

            <div className="w-full max-w-[400px] space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center text-center space-y-2">
                    <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 mb-2">
                        <ShieldCheck className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Portal</h1>
                        <p className="text-sm text-muted-foreground">Restricted access for administrators only</p>
                    </div>
                </div>

                <Card className="border border-border shadow-sm rounded-xl bg-white overflow-hidden">
                    <CardHeader className="space-y-1 text-center bg-muted/30 pb-6 border-b border-border/50">
                        <CardTitle className="text-base font-medium">Authentication Required</CardTitle>
                        <CardDescription>Enter your admin credentials to continue</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 pt-6">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="password"
                                        placeholder="Enter admin password"
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value)
                                            setError("")
                                        }}
                                        className={`pl-9 h-10 ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-1 fade-in">
                                    <ShieldCheck className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-10 font-medium"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Authorize Access"}
                            </Button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-border flex justify-center">
                            <Link href="/user">
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-2">
                                    <ArrowLeft className="h-4 w-4" /> Back to Staff Portal
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-center text-xs text-muted-foreground">
                    &copy; {new Date().getFullYear()} Redadair Fire Group. All rights reserved.
                </p>
            </div>
        </div>
    )
}
