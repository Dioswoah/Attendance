"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Flame, RefreshCcw, AlertTriangle } from "lucide-react"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Application Error:", error)
    }, [error])

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-muted/20 p-4">
            <Card className="w-full max-w-md border border-border shadow-lg rounded-xl overflow-hidden bg-white">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
                    <div className="h-20 w-20 rounded-full bg-amber-50 flex items-center justify-center mb-2">
                        <div className="relative">
                            <Flame className="h-10 w-10 text-[#8B2323]" />
                            <AlertTriangle className="h-5 w-5 text-amber-600 absolute -bottom-1 -right-1 fill-white outline-4 outline-white" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Something Went Wrong</h1>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            The system encountered an unexpected structural failure and was unable to process the request.
                        </p>
                    </div>

                    {/* Error Snippet (Optional/Subtle) */}
                    <div className="w-full p-3 bg-muted/30 rounded-lg text-left overflow-hidden">
                        <p className="text-[10px] font-mono text-muted-foreground break-all line-clamp-2">
                            {error.message || "An unknown system error occurred."}
                        </p>
                        {error.digest && (
                            <p className="text-[9px] font-mono text-muted-foreground/60 mt-1 uppercase">
                                Trace ID: {error.digest}
                            </p>
                        )}
                    </div>

                    <div className="w-full pt-2 flex flex-col gap-3">
                        <Button
                            onClick={() => reset()}
                            className="w-full gap-2 font-medium bg-[#8B2323] hover:bg-[#7A1F1F]"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            Attempt Recovery
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => window.location.href = '/'}
                            className="w-full text-xs"
                        >
                            Return to Command Center
                        </Button>
                    </div>

                    <p className="text-xs text-muted-foreground/50 pt-2">
                        Error Code: 500_SECTOR_CRASH
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
