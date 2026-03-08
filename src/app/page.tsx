"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { signIn, useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import {
    Lock,
    ShieldAlert,
    LogIn,
    Loader2,
    Clock,
    Hourglass,
    Calendar,
    Timer,
    History
} from "lucide-react"

function LoginContent() {
    const { data: session, status } = useSession() as any
    const searchParams = useSearchParams()
    const router = useRouter()
    const [showUnauthorizedDialog, setShowUnauthorizedDialog] = useState(false)
    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const [rememberMe, setRememberMe] = useState(true)

    useEffect(() => {
        const error = searchParams.get("error")
        // Only show dialog if there's an explicit unauthorized error
        if (error === "unauthorized") {
            setShowUnauthorizedDialog(true)
        }
    }, [searchParams])

    const handleGoogleLogin = async () => {
        setIsLoggingIn(true)
        try {
            await signIn("google", {
                callbackUrl: "/user",
                ...(!rememberMe && { prompt: 'select_account' })
            })
        } catch (error) {
            // Login failed
        } finally {
            setIsLoggingIn(false)
        }
    }

    if (status === "loading" || status === "authenticated") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30 relative overflow-hidden">
                {/* Background elements */}
                <div className="absolute top-0 right-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

                {/* Time-themed Background Shapes */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <Clock className="absolute top-[10%] left-[10%] w-32 h-32 text-slate-300/20 rotate-12" />
                    <Hourglass className="absolute bottom-[15%] right-[10%] w-40 h-40 text-slate-300/20 -rotate-12" />
                    <Calendar className="absolute top-[20%] right-[20%] w-24 h-24 text-slate-300/15 rotate-6" />
                    <Timer className="absolute bottom-[20%] left-[20%] w-28 h-28 text-slate-300/15 -rotate-6" />
                    <History className="absolute top-[50%] left-[5%] w-20 h-20 text-slate-300/10 rotate-45" />
                </div>

                <Loader2 className="h-8 w-8 animate-spin text-red-600 relative z-10" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

            {/* Time-themed Background Shapes */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <Clock className="absolute top-[10%] left-[10%] w-32 h-32 text-slate-300/20 rotate-12" />
                <Hourglass className="absolute bottom-[15%] right-[10%] w-40 h-40 text-slate-300/20 -rotate-12" />
                <Calendar className="absolute top-[20%] right-[20%] w-24 h-24 text-slate-300/15 rotate-6" />
                <Timer className="absolute bottom-[20%] left-[20%] w-28 h-28 text-slate-300/15 -rotate-6" />
                <History className="absolute top-[50%] left-[5%] w-20 h-20 text-slate-300/10 rotate-45" />
            </div>

            <div className="w-full max-w-[400px] space-y-6 animate-in fade-in zoom-in duration-500 relative z-10">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="h-28 w-28 bg-white rounded-3xl flex items-center justify-center shadow-lg mb-2 overflow-hidden border border-border/50">
                        <img src="/logo.png" alt="RSA Logo" className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Redadair</h1>
                        <p className="text-muted-foreground uppercase tracking-widest text-xs font-semibold">Staff Availability</p>
                    </div>
                </div>

                <Card className="border-border shadow-xl rounded-xl bg-white/80 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="space-y-1 text-center pb-6 border-b border-border/50">
                        <CardDescription className="text-base text-center">
                            Authorized personnel only. Please sign in with your corporate Google account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 pt-8 space-y-6">
                        {status === "authenticated" && session?.user ? (
                            <div className="flex flex-col items-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="space-y-2 text-center">
                                    <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
                                    <p className="text-sm text-muted-foreground">Jump into your account to keep designing</p>
                                </div>

                                <Card className="w-full border-none shadow-none bg-accent/50 p-6 rounded-2xl flex flex-col items-center space-y-4">
                                    <div className="h-20 w-20 rounded-full overflow-hidden border-4 border-white shadow-md">
                                        <img
                                            src={session.user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.name || "User")}&background=8B2323&color=fff`}
                                            alt={session.user.name || "User"}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-lg">{session.user.name}</p>
                                        <p className="text-sm text-muted-foreground">{session.user.email}</p>
                                    </div>
                                    <Button
                                        onClick={() => router.push("/user")}
                                        className="w-full h-12 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-xl text-lg transition-all shadow-lg hover:shadow-red-900/20"
                                    >
                                        Continue
                                    </Button>
                                </Card>

                                <button
                                    onClick={() => signIn("google", { callbackUrl: "/user", prompt: "select_account" })}
                                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                                >
                                    <LogIn className="h-4 w-4" />
                                    Continue with another account
                                </button>
                            </div>
                        ) : (
                            <>
                                <Button
                                    onClick={handleGoogleLogin}
                                    disabled={isLoggingIn}
                                    className="w-full h-12 text-base bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition-all"
                                >
                                    {isLoggingIn ? (
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    ) : (
                                        <svg className="mr-3 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                            <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                                        </svg>
                                    )}
                                    Secure Sign In
                                </Button>

                                <div className="flex items-center space-x-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
                                    />
                                    <label
                                        htmlFor="remember"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
                                    >
                                        Remember me for 30 days
                                    </label>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={showUnauthorizedDialog} onOpenChange={setShowUnauthorizedDialog}>
                <DialogContent>
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-red-600 mb-2">
                            <ShieldAlert className="h-6 w-6" />
                            <DialogTitle>Authentication Required</DialogTitle>
                        </div>
                        <DialogDescription className="pt-2 text-base">
                            You must be signed in to access this page. Please log in with your credentials to continue.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end mt-4">
                        <Button onClick={() => setShowUnauthorizedDialog(false)}>
                            I Understand
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-muted/30 relative overflow-hidden">
                {/* Background elements */}
                <div className="absolute top-0 right-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

                {/* Time-themed Background Shapes */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <Clock className="absolute top-[10%] left-[10%] w-32 h-32 text-slate-300/20 rotate-12" />
                    <Hourglass className="absolute bottom-[15%] right-[10%] w-40 h-40 text-slate-300/20 -rotate-12" />
                    <Calendar className="absolute top-[20%] right-[20%] w-24 h-24 text-slate-300/15 rotate-6" />
                    <Timer className="absolute bottom-[20%] left-[20%] w-28 h-28 text-slate-300/15 -rotate-6" />
                    <History className="absolute top-[50%] left-[5%] w-20 h-20 text-slate-300/10 rotate-45" />
                </div>

                <Loader2 className="h-8 w-8 animate-spin text-red-600 relative z-10" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    )
}

