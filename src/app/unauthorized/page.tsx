"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
    ShieldAlert,
    ArrowLeft,
    Lock,
    Clock,
    Hourglass,
    Calendar,
    Timer,
    History
} from "lucide-react"

export default function UnauthorizedPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    useEffect(() => {
        if (status === "authenticated" && session?.user?.email?.endsWith("@redadair.com.au")) {
            router.push("/user")
        }
    }, [session, status, router])

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-muted/20 p-4 relative overflow-hidden">
            {/* Time-themed Background Shapes */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <Clock className="absolute top-[10%] left-[10%] w-32 h-32 text-slate-300/20 rotate-12" />
                <Hourglass className="absolute bottom-[15%] right-[10%] w-40 h-40 text-slate-300/20 -rotate-12" />
                <Calendar className="absolute top-[20%] right-[20%] w-24 h-24 text-slate-300/15 rotate-6" />
                <Timer className="absolute bottom-[20%] left-[20%] w-28 h-28 text-slate-300/15 -rotate-6" />
                <History className="absolute top-[50%] left-[5%] w-20 h-20 text-slate-300/10 rotate-45" />
                <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-red-100/30 rounded-full blur-3xl opacity-50" />
                <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-slate-200/50 rounded-full blur-3xl opacity-50" />
            </div>

            <Card className="w-full max-w-md border border-border shadow-2xl rounded-[2rem] overflow-hidden bg-white/90 backdrop-blur-sm relative z-10">
                <div className="bg-[#8B2323] p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />

                    {/* Header Icon/Logo */}
                    <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center shadow-xl mx-auto mb-4 p-2 relative z-10">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>

                    <h1 className="text-2xl font-black italic text-white uppercase tracking-tight relative z-10">Access Restricted</h1>
                    <p className="text-white/60 font-bold text-[10px] uppercase tracking-widest mt-2 relative z-10">
                        Workspace Verification Failed
                    </p>
                </div>

                <CardContent className="p-8 text-center space-y-6">
                    <p className="text-slate-600 font-medium text-sm leading-relaxed">
                        Our system has identified your account, but it is not associated with the authorized <strong>Google Workspace</strong>.
                        <br /><br />
                        Please sign in using your corporate credentials to proceed.
                    </p>

                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 w-full flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                            <Lock className="h-5 w-5 text-red-700" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-800/60">Authentication Requirement</p>
                            <p className="text-sm font-bold text-red-900">Verified Organization Account</p>
                        </div>
                    </div>

                    <div className="w-full pt-2">
                        <Link href="/" className="w-full">
                            <Button className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-xs">
                                <ArrowLeft className="h-4 w-4" />
                                Return to Sign In
                            </Button>
                        </Link>
                    </div>

                    <p className="text-[10px] font-mono text-muted-foreground/40 pt-4">
                        ERR_403_INVALID_WORKSPACE_DOMAIN
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
