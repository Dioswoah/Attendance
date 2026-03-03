"use client"

import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"
import { SessionGuard } from "@/components/SessionGuard"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
            <SessionGuard>
                {children}
            </SessionGuard>
            <Toaster
                position="top-right"
                richColors
                closeButton
                toastOptions={{
                    classNames: {
                        actionButton: "!bg-red-600 hover:!bg-red-700 !text-white !font-medium",
                        cancelButton: "!bg-gray-100 hover:!bg-gray-200 !text-gray-900 !font-medium",
                    }
                }}
            />
        </SessionProvider>
    )
}
