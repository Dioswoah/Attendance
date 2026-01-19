"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Flame, ArrowLeft, FileQuestion } from "lucide-react"

export default function NotFound() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-muted/20 p-4">
            <Card className="w-full max-w-md border border-border shadow-lg rounded-xl overflow-hidden bg-white">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
                    <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center mb-2">
                        <div className="relative">
                            <Flame className="h-10 w-10 text-red-600" />
                            <FileQuestion className="h-5 w-5 text-red-600 absolute -bottom-1 -right-1 fill-white outline-4 outline-white" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Page Not Found</h1>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            The requested structural node could not be located within the active sector.
                        </p>
                    </div>

                    <div className="w-full pt-4">
                        <Link href="/" className="w-full">
                            <Button className="w-full gap-2 font-medium">
                                <ArrowLeft className="h-4 w-4" />
                                Return to Command Center
                            </Button>
                        </Link>
                    </div>

                    <p className="text-xs text-muted-foreground/50 pt-4">
                        Error Code: 404_NODE_MISSING
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
