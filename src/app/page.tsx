"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { signIn, useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Lock, ShieldAlert, LogIn, Loader2 } from "lucide-react"

function LoginContent() {
    const { data: session, status } = useSession()
    const searchParams = useSearchParams()
    const router = useRouter()
    const [showUnauthorizedDialog, setShowUnauthorizedDialog] = useState(false)
    const [isLoggingIn, setIsLoggingIn] = useState(false)

    useEffect(() => {
        // If user is already logged in, redirect to dashboard
        if (status === "authenticated") {
            router.replace("/user")
        }
    }, [status, router])

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
            await signIn("google", { callbackUrl: "/user" })
        } catch (error) {
            // Login failed
        } finally {
            setIsLoggingIn(false)
        }
    }

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
        )
    }

    if (status === "authenticated") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

            <div className="w-full max-w-[400px] space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-2 overflow-hidden border border-border/50">
                        <img src="/logo.png" alt="RSA Logo" className="w-full h-full object-cover p-1" />
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
                    <CardContent className="p-6 pt-8">
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
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    )
}

