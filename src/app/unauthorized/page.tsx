"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
    ShieldAlert,
    ArrowLeft,
    Lock,
    Clock,
    Hourglass,
    Calendar,
    Timer,
    History,
    RefreshCw,
    LogOut
} from "lucide-react"

export default function UnauthorizedPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-muted/20" />}>
            <UnauthorizedContent />
        </Suspense>
    )
}

function UnauthorizedContent() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const reason = searchParams ? searchParams.get('reason') : null

    useEffect(() => {
        const error = (session as any)?.error;
        // Only redirect to /user if authenticated AND no session errors
        if (status === "authenticated" &&
            session?.user?.email?.endsWith("@redadair.com.au") &&
            !error &&
            reason !== 'archived') {
            router.push("/user")
        }
    }, [session, status, router, reason])

    const getReasonDetails = () => {
        switch (reason) {
            case 'archived':
                return {
                    title: 'Account Deactivated',
                    subtitle: 'Administrator Action Required',
                    message: <>Your profile has been archived or removed from the system.<br /><br />Please contact your administrator if you believe this is an error.</>,
                    icon: <Lock className="h-5 w-5 text-red-700" />,
                    badge: 'Active Account Verification',
                    errorCode: 'ERR_403_USER_ARCHIVED'
                };
            case 'forced':
                return {
                    title: 'Session Expired',
                    subtitle: 'Remote Sign-Out Triggered',
                    message: <>An administrator has requested a fresh sign-in for your account to ensure security.<br /><br />Please sign in again to continue.</>,
                    icon: <LogOut className="h-5 w-5 text-indigo-700" />,
                    badge: 'Security Requirement',
                    errorCode: 'ERR_401_FORCE_LOGOUT'
                };
            case 'refresh_failed':
                return {
                    title: 'Authentication Lost',
                    subtitle: 'Google Workspace Token Expired',
                    message: <>We were unable to verify your Google Workspace credentials after a period of inactivity.<br /><br />Please sign in again to refresh your session.</>,
                    icon: <RefreshCw className="h-5 w-5 text-amber-700" />,
                    badge: 'Session Refresh Required',
                    errorCode: 'ERR_401_REFRESH_FAILED'
                };
            default:
                return {
                    title: 'Access Restricted',
                    subtitle: 'Workspace Verification Failed',
                    message: <>Our system has identified your account, but it is not associated with the authorized <strong>Google Workspace</strong>.<br /><br />Please sign in using your corporate credentials.</>,
                    icon: <Lock className="h-5 w-5 text-red-700" />,
                    badge: 'Verified Organization Account',
                    errorCode: 'ERR_403_INVALID_DOMAIN'
                };
        }
    };

    const details = getReasonDetails();

    const handleReset = async () => {
        // Clear everything and go to home
        await signOut({ callbackUrl: "/" });
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-muted/20 p-4 relative overflow-hidden">
            {/* Background Shapes */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <Clock className="absolute top-[10%] left-[10%] w-32 h-32 text-slate-300/20 rotate-12" />
                <Hourglass className="absolute bottom-[15%] right-[10%] w-40 h-40 text-slate-300/20 -rotate-12" />
                <Calendar className="absolute top-[20%] right-[20%] w-24 h-24 text-slate-300/15 rotate-6" />
                <Timer className="absolute bottom-[20%] left-[20%] w-28 h-28 text-slate-300/15 -rotate-6" />
                <History className="absolute top-[50%] left-[5%] w-20 h-20 text-slate-300/10 rotate-45" />
                <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-red-100/30 rounded-full blur-3xl opacity-50" />
            </div>

            <Card className="w-full max-w-md border border-border shadow-2xl rounded-[2rem] overflow-hidden bg-white/90 backdrop-blur-sm relative z-10">
                <div className="bg-[#8B2323] p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />

                    <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center shadow-xl mx-auto mb-4 p-2 relative z-10">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>

                    <h1 className="text-2xl font-black italic text-white uppercase tracking-tight relative z-10">
                        {details.title}
                    </h1>
                    <p className="text-white/60 font-bold text-[10px] uppercase tracking-widest mt-2 relative z-10">
                        {details.subtitle}
                    </p>
                </div>

                <CardContent className="p-8 text-center space-y-6">
                    <p className="text-slate-600 font-medium text-sm leading-relaxed">
                        {details.message}
                    </p>

                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 w-full flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                            {details.icon}
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status Check</p>
                            <p className="text-sm font-bold text-slate-700">
                                {details.badge}
                            </p>
                        </div>
                    </div>

                    <div className="w-full pt-2">
                        <Button
                            onClick={handleReset}
                            className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Return to Sign In
                        </Button>
                    </div>

                    <p className="text-[10px] font-mono text-muted-foreground/40 pt-4 uppercase">
                        {details.errorCode}
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
