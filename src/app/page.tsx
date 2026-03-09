"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { signIn, useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import {
    ShieldAlert,
    LogIn,
    Loader2,
    Clock,
    Hourglass,
    Calendar,
    Timer,
    History
} from "lucide-react"

const GOOGLE_CLIENT_ID = "712513641417-u41tcunopiksskm9ba7u27ncuv0kp54a.apps.googleusercontent.com"

/** Exchange a Google One Tap credential JWT directly — no OAuth redirect, no account chooser */
async function exchangeOneTapCredential(credential: string) {
    await signIn("google-onetap", { credential, callbackUrl: "/user" })
}

function LoginContent() {
    const { data: session, status } = useSession() as any
    const searchParams = useSearchParams()
    const router = useRouter()
    const [showUnauthorizedDialog, setShowUnauthorizedDialog] = useState(false)
    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const [lastUser, setLastUser] = useState<{ name: string; email: string; image: string } | null>(null)
    const oneTapReady = useRef(false)

    // ── Load stored user (shows "Jump back in" card) ──────────────────────────
    useEffect(() => {
        try {
            const stored = localStorage.getItem("last_logged_in_user")
            if (stored) setLastUser(JSON.parse(stored))
        } catch { }
    }, [])

    // ── Error query param ─────────────────────────────────────────────────────
    useEffect(() => {
        if (searchParams.get("error") === "unauthorized") setShowUnauthorizedDialog(true)
    }, [searchParams])

    // ── On successful auth: persist user info and go to portal ────────────────
    useEffect(() => {
        if (status === "authenticated" && session?.user) {
            localStorage.setItem("last_logged_in_user", JSON.stringify({
                name: session.user.name ?? "",
                email: session.user.email ?? "",
                image: session.user.image ?? "",
            }))
            router.push("/user")
        }
    }, [status, session, router])

    // ── Google One Tap initialization ─────────────────────────────────────────
    // With auto_select:true, Google will silently fire the callback for returning
    // users who previously consented via One Tap — landing them straight on /user.
    // The top-right FedCM popup also shows for manual account selection.
    useEffect(() => {
        if (status !== "unauthenticated" || oneTapReady.current) return

        const initOneTap = () => {
            const google = (window as any).google
            if (!google?.accounts?.id) return
            oneTapReady.current = true

            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response: any) => {
                    setIsLoggingIn(true)
                    try {
                        await exchangeOneTapCredential(response.credential)
                    } catch (e) {
                        console.error("One Tap callback error:", e)
                        setIsLoggingIn(false)
                    }
                },
                auto_select: true,  // silently re-auth returning users
            })
            google.accounts.id.prompt()
        }

        if ((window as any).google?.accounts?.id) {
            initOneTap()
        } else {
            const script = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
            if (script) {
                script.addEventListener("load", initOneTap, { once: true })
            } else {
                const timer = setInterval(() => {
                    if ((window as any).google?.accounts?.id) {
                        clearInterval(timer)
                        initOneTap()
                    }
                }, 200)
                return () => clearInterval(timer)
            }
        }
    }, [status])

    // ── "Continue" — sign in as the remembered account via One Tap ───────────
    // Re-initializes One Tap with hint + auto_select so Google fires the callback
    // immediately without showing any UI (no redirect, no account chooser).
    // Falls back to OAuth login_hint if One Tap can't auto-select.
    const handleContinue = () => {
        const google = (window as any).google
        if (!google?.accounts?.id || !lastUser?.email) return

        setIsLoggingIn(true)
        oneTapReady.current = false

        google.accounts.id.cancel()
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: async (response: any) => {
                try {
                    await exchangeOneTapCredential(response.credential)
                } catch {
                    setIsLoggingIn(false)
                }
            },
            hint: lastUser.email,
            auto_select: true,
        })
        google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                // One Tap couldn't auto-select, fall back to OAuth with the stored email
                setIsLoggingIn(false)
                signIn("google", { callbackUrl: "/user", login_hint: lastUser!.email })
            }
        })
    }

    // ── "Continue with another account" / "Secure Sign In" ───────────────────
    // Always opens the full Google account chooser (image 3 from the user's reference).
    const handleChooseAccount = async () => {
        setIsLoggingIn(true)
        try {
            await signIn("google", { callbackUrl: "/user", prompt: "select_account" })
        } catch {
            setIsLoggingIn(false)
        }
    }

    // ── Background decoration shared across states ────────────────────────────
    const Bg = () => (
        <>
            <div className="absolute top-0 right-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <Clock className="absolute top-[10%] left-[10%] w-32 h-32 text-slate-300/20 rotate-12" />
                <Hourglass className="absolute bottom-[15%] right-[10%] w-40 h-40 text-slate-300/20 -rotate-12" />
                <Calendar className="absolute top-[20%] right-[20%] w-24 h-24 text-slate-300/15 rotate-6" />
                <Timer className="absolute bottom-[20%] left-[20%] w-28 h-28 text-slate-300/15 -rotate-6" />
                <History className="absolute top-[50%] left-[5%] w-20 h-20 text-slate-300/10 rotate-45" />
            </div>
        </>
    )

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30 relative overflow-hidden">
                <Bg />
                <Loader2 className="h-8 w-8 animate-spin text-red-600 relative z-10" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6 relative overflow-hidden">
            <Bg />

            <div className="w-full max-w-[400px] space-y-6 animate-in fade-in zoom-in duration-500 relative z-10">
                {/* Logo + App name */}
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="h-28 w-28 bg-white rounded-3xl flex items-center justify-center shadow-lg mb-2 overflow-hidden border border-border/50">
                        <img src="/logo.png" alt="RSA Logo" className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Redadair</h1>
                        <p className="text-muted-foreground uppercase tracking-widest text-xs font-semibold">Staff Availability</p>
                    </div>
                </div>

                {/* Login Card */}
                <Card className="border-border shadow-xl rounded-xl bg-white/80 backdrop-blur-sm overflow-hidden text-center">
                    <CardHeader className="pb-4 border-b border-border/50">
                        <CardDescription className="text-base">
                            {lastUser ? "Jump back in!" : "Authorized personnel only. Sign in with your corporate Google account."}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 pt-7 space-y-5">
                        {lastUser ? (
                            /* ─── Returning user: "Jump back in" (Canva-style) ─── */
                            <div className="flex flex-col items-center space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Avatar */}
                                <div className="h-20 w-20 rounded-full overflow-hidden border-[3px] border-white shadow-md">
                                    <img
                                        src={lastUser.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(lastUser.name || "User")}&background=8B2323&color=fff`}
                                        alt={lastUser.name}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                    />
                                </div>

                                {/* Name + Email */}
                                <div className="text-center">
                                    <p className="font-bold text-lg text-foreground leading-tight">{lastUser.name}</p>
                                    <p className="text-sm text-muted-foreground">{lastUser.email}</p>
                                </div>

                                {/* Continue — signs in as this account immediately */}
                                <Button
                                    onClick={handleContinue}
                                    disabled={isLoggingIn}
                                    className="w-full h-11 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-xl text-base transition-all shadow-md"
                                >
                                    {isLoggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}
                                </Button>

                                {/* Divider */}
                                <div className="flex items-center w-full gap-3">
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-xs font-medium text-muted-foreground">OR</span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>

                                {/* Use a different account → account chooser */}
                                <button
                                    onClick={handleChooseAccount}
                                    disabled={isLoggingIn}
                                    className="text-sm font-medium text-muted-foreground hover:text-[#8B2323] transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <LogIn className="h-4 w-4" />
                                    Continue with another account
                                </button>
                            </div>
                        ) : (
                            /* ─── First-time: standard sign-in button ─── */
                            <Button
                                onClick={handleChooseAccount}
                                disabled={isLoggingIn}
                                className="w-full h-12 text-base bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition-all"
                            >
                                {isLoggingIn ? (
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                ) : (
                                    <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                        <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
                                    </svg>
                                )}
                                Secure Sign In
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Unauthorized dialog */}
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
                        <Button onClick={() => setShowUnauthorizedDialog(false)}>I Understand</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default function LoginPage() {
    const Fallback = () => (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            <Loader2 className="h-8 w-8 animate-spin text-red-600 relative z-10" />
        </div>
    )
    return (
        <Suspense fallback={<Fallback />}>
            <LoginContent />
        </Suspense>
    )
}
