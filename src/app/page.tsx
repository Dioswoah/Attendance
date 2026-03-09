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

// Decorative background (shared)
function LoginBg() {
    return (
        <>
            <div className="absolute top-0 right-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <Clock className="absolute top-[10%]  left-[10%]  w-32 h-32 text-slate-300/20 rotate-12" />
                <Hourglass className="absolute bottom-[15%] right-[10%] w-40 h-40 text-slate-300/20 -rotate-12" />
                <Calendar className="absolute top-[20%]  right-[20%] w-24 h-24 text-slate-300/15 rotate-6" />
                <Timer className="absolute bottom-[20%] left-[20%]  w-28 h-28 text-slate-300/15 -rotate-6" />
                <History className="absolute top-[50%]  left-[5%]   w-20 h-20 text-slate-300/10 rotate-45" />
            </div>
        </>
    )
}

// Avatar helper
function Avatar({ src, name }: { src?: string; name?: string }) {
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&background=8B2323&color=fff`
    return (
        <div className="h-20 w-20 rounded-full overflow-hidden border-[3px] border-white shadow-md">
            <img
                src={src || fallback}
                alt={name || "User"}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).src = fallback }}
            />
        </div>
    )
}

type StoredUser = { name: string; email: string; image: string }
type DetectedUser = StoredUser & { credential: string }

/** Shows while waiting for Google One Tap auto_select to fire.
 *  Fades in the "Secure Sign In" button after 2.5s if nothing is detected. */
function DetectingState({ onManualLogin, isLoggingIn }: { onManualLogin: () => void; isLoggingIn: boolean }) {
    const [showFallback, setShowFallback] = useState(false)
    useEffect(() => {
        const t = setTimeout(() => setShowFallback(true), 2500)
        return () => clearTimeout(t)
    }, [])

    if (showFallback) {
        return (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-500">
                <p className="text-xs text-center text-muted-foreground">
                    Sign in with your corporate Google account
                </p>
                <Button
                    onClick={onManualLogin}
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
            </div>
        )
    }

    // Skeleton — same layout as the account card, pulsing while detecting
    return (
        <div className="flex flex-col items-center space-y-5 animate-in fade-in duration-300">
            {/* Avatar skeleton */}
            <div className="h-20 w-20 rounded-full bg-slate-200 animate-pulse" />
            {/* Name skeleton */}
            <div className="space-y-2 w-full flex flex-col items-center">
                <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-44 rounded bg-slate-100 animate-pulse" />
            </div>
            {/* Button skeleton */}
            <div className="h-11 w-full rounded-xl bg-slate-200 animate-pulse" />
            <p className="text-xs text-muted-foreground">Detecting your account…</p>
        </div>
    )
}

function LoginContent() {
    const { data: session, status } = useSession() as any
    const searchParams = useSearchParams()
    const router = useRouter()

    const [showUnauthorizedDialog, setShowUnauthorizedDialog] = useState(false)
    const [isLoggingIn, setIsLoggingIn] = useState(false)

    // detectedUser  → fresh from the Google One Tap popup (has credential ready to use)
    // storedUser    → from localStorage, saved after a previous login (shows "Jump back in" card)
    // The card shows detectedUser first, then storedUser, then nothing (generic button)
    const [detectedUser, setDetectedUser] = useState<DetectedUser | null>(null)
    const [storedUser, setStoredUser] = useState<StoredUser | null>(null)
    const oneTapReady = useRef(false)

    const displayUser: StoredUser | null = detectedUser ?? storedUser

    // ── Load stored user from localStorage ───────────────────────────────────
    useEffect(() => {
        try {
            const raw = localStorage.getItem("last_logged_in_user")
            if (raw) setStoredUser(JSON.parse(raw))
        } catch { }
    }, [])

    // ── Error query param ─────────────────────────────────────────────────────
    useEffect(() => {
        if (searchParams.get("error") === "unauthorized") setShowUnauthorizedDialog(true)
    }, [searchParams])

    // ── On authenticated: always persist account info and redirect ───────────
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
    // When user clicks an account in the top-right One Tap popup:
    //   → immediately sign them in → redirect to /user (no extra Continue click needed)
    // The center card "Continue" button is for the localStorage remembered user path.
    useEffect(() => {
        if (status !== "unauthenticated" || oneTapReady.current) return

        const init = () => {
            const g = (window as any).google
            if (!g?.accounts?.id) return
            oneTapReady.current = true

            g.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response: any) => {
                    try {
                        const payload = JSON.parse(
                            atob(response.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
                        )
                        const accountInfo = { name: payload.name, email: payload.email, image: payload.picture ?? "" }
                        localStorage.setItem("last_logged_in_user", JSON.stringify(accountInfo))
                        setStoredUser(accountInfo)

                        setIsLoggingIn(true)
                        await signIn("google-onetap", { credential: response.credential, callbackUrl: "/user" })
                    } catch (e) {
                        console.error("One Tap error:", e)
                        setIsLoggingIn(false)
                    }
                },
                // do NOT auto_select — that would silently log in without user seeing it
                auto_select: false,
                // cancel_on_tap_outside keeps the prompt alive if user clicks elsewhere
                cancel_on_tap_outside: false,
            })

            // Show the One Tap prompt (appears top-right as a sign-in widget)
            g.accounts.id.prompt((notification: any) => {
                if (notification.isNotDisplayed()) {
                    console.log('[OneTap] not displayed:', notification.getNotDisplayedReason())
                } else if (notification.isSkippedMoment()) {
                    console.log('[OneTap] skipped:', notification.getSkippedReason())
                } else if (notification.isDismissedMoment()) {
                    console.log('[OneTap] dismissed:', notification.getDismissedReason())
                }
            })
        }

        if ((window as any).google?.accounts?.id) {
            init()
        } else {
            const script = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
            if (script) {
                script.addEventListener("load", init, { once: true })
            } else {
                const t = setInterval(() => {
                    if ((window as any).google?.accounts?.id) { clearInterval(t); init() }
                }, 200)
                return () => clearInterval(t)
            }
        }
    }, [status])

    // ── "Continue": sign in as the displayed account ─────────────────────────
    // Uses prompt="none" + login_hint so Google silently authenticates the stored
    // account WITHOUT showing an account chooser. If silent auth fails (e.g. session
    // expired), we fall back to the full OAuth flow with login_hint pre-filled.
    const handleContinue = async () => {
        setIsLoggingIn(true)
        try {
            if (detectedUser?.credential) {
                // Fresh credential from the One Tap widget → use it directly (fastest)
                await signIn("google-onetap", { credential: detectedUser.credential, callbackUrl: "/user" })
            } else if (storedUser?.email) {
                // Silent OAuth: tells Google to skip the account chooser and use the
                // already-consented account matching the login_hint email.
                // If the Google session is still valid this redirects straight to /user.
                await signIn("google", {
                    callbackUrl: "/user",
                    login_hint: storedUser.email,
                    prompt: "none",   // ← skip account chooser
                })
            }
        } catch {
            setIsLoggingIn(false)
        }
    }

    // ── "Continue with another account" / "Secure Sign In" ───────────────────
    // Always shows the full Google account chooser
    const handleChooseAccount = async () => {
        setIsLoggingIn(true)
        try {
            await signIn("google", { callbackUrl: "/user", prompt: "select_account" })
        } catch {
            setIsLoggingIn(false)
        }
    }

    // ── Loading ───────────────────────────────────────────────────────────────
    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30 relative overflow-hidden">
                <LoginBg />
                <Loader2 className="h-8 w-8 animate-spin text-red-600 relative z-10" />
            </div>
        )
    }

    // ── Login Page ────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6 relative overflow-hidden">
            <LoginBg />

            <div className="w-full max-w-[400px] space-y-6 animate-in fade-in zoom-in duration-500 relative z-10">

                {/* Brand header */}
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="h-28 w-28 bg-white rounded-3xl flex items-center justify-center shadow-lg mb-2 overflow-hidden border border-border/50">
                        <img src="/logo.png" alt="Redadair Logo" className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Redadair</h1>
                        <p className="text-muted-foreground uppercase tracking-widest text-xs font-semibold">Staff Availability</p>
                    </div>
                </div>

                {/* Login Card */}
                <Card className="border-border shadow-xl rounded-xl bg-white/80 backdrop-blur-sm overflow-hidden text-center">
                    <CardHeader className="pb-4 border-b border-border/50">
                        <CardDescription className="text-base font-medium">
                            {displayUser
                                ? detectedUser
                                    ? "Sign in to continue"       // One Tap just picked an account
                                    : "Jump back in!"             // Remembered from last session
                                : "Authorized personnel only. Sign in with your corporate Google account."
                            }
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 pt-7 space-y-5">

                        {displayUser ? (
                            /* ── Account card (detected OR remembered) ── */
                            <div className="flex flex-col items-center space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-400">

                                {/* Avatar */}
                                <Avatar src={displayUser.image} name={displayUser.name} />

                                {/* Name + email */}
                                <div className="text-center -mt-1 space-y-0.5">
                                    <p className="font-bold text-lg text-foreground leading-tight">{displayUser.name}</p>
                                    <p className="text-sm text-muted-foreground">{displayUser.email}</p>
                                </div>

                                {/* Continue — uses the stored credential or re-triggers One Tap */}
                                <Button
                                    onClick={handleContinue}
                                    disabled={isLoggingIn}
                                    className="w-full h-11 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-xl text-base transition-all shadow-md hover:shadow-red-900/30"
                                >
                                    {isLoggingIn
                                        ? <Loader2 className="h-5 w-5 animate-spin" />
                                        : "Continue"}
                                </Button>

                                {/* Divider */}
                                <div className="flex items-center w-full gap-3">
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-xs font-medium text-muted-foreground">OR</span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>

                                {/* Switch account → full Google account chooser */}
                                <button
                                    onClick={handleChooseAccount}
                                    disabled={isLoggingIn}
                                    className="text-sm font-medium text-muted-foreground hover:text-[#8B2323] transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <LogIn className="h-4 w-4" />
                                    Sign in with another account
                                </button>
                            </div>
                        ) : (
                            /* ── No stored account yet: show skeleton while One Tap detects ── */
                            <DetectingState onManualLogin={handleChooseAccount} isLoggingIn={isLoggingIn} />
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
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-muted/30 relative overflow-hidden">
                <LoginBg />
                <Loader2 className="h-8 w-8 animate-spin text-red-600 relative z-10" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    )
}
