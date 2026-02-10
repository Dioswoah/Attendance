"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Flame, RefreshCcw, ShieldAlert } from "lucide-react"
import "./globals.css"

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <html lang="en">
            <body className="antialiased">
                <div className="min-h-screen w-full flex items-center justify-center bg-muted/20 p-4 font-sans">
                    <Card className="w-full max-w-md border border-border shadow-2xl rounded-2xl overflow-hidden bg-white">
                        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
                            <div className="h-24 w-24 rounded-3xl bg-red-50 flex items-center justify-center mb-4 animate-pulse">
                                <div className="relative">
                                    <Flame className="h-12 w-12 text-[#8B2323]" />
                                    <ShieldAlert className="h-6 w-6 text-red-600 absolute -bottom-2 -right-2 fill-white outline-4 outline-white" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic">Critical Failure</h1>
                                <p className="text-sm font-medium text-muted-foreground max-w-xs mx-auto">
                                    A total structural collapse has been detected in the core layer. The application is currently offline.
                                </p>
                            </div>

                            <div className="w-full p-4 bg-red-50/50 rounded-xl text-left border border-red-100">
                                <p className="text-xs font-bold text-red-900 uppercase tracking-widest mb-1">Internal Diagnostic</p>
                                <p className="text-[10px] font-mono text-red-700/80 break-all line-clamp-3">
                                    {error.message || "Root environment disruption detected."}
                                </p>
                            </div>

                            <div className="w-full pt-4">
                                <Button
                                    onClick={() => reset()}
                                    className="w-full h-12 gap-3 font-black uppercase tracking-widest bg-[#8B2323] hover:bg-[#7A1F1F] text-white shadow-lg shadow-red-900/20 transition-all active:scale-95"
                                >
                                    <RefreshCcw className="h-5 w-5" />
                                    Reboot System
                                </Button>
                            </div>

                            <p className="text-[10px] font-bold text-muted-foreground/40 pt-4 uppercase tracking-[0.2em]">
                                Error Hash: {error.digest || "CORE_LAYER_SYNC_ERR"}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </body>
        </html>
    )
}
