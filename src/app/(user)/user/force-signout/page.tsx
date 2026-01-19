"use client"

import { signOut } from "next-auth/react"
import { useEffect } from "react"

export default function ForceSignOutPage() {
    useEffect(() => {
        // Clear all cookies and session
        document.cookie.split(";").forEach((c) => {
            document.cookie = c
                .replace(/^ +/, "")
                .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
        })

        // Clear localStorage
        localStorage.clear()

        // Clear sessionStorage
        sessionStorage.clear()

        // Sign out and redirect
        setTimeout(() => {
            signOut({ callbackUrl: '/user' })
        }, 1000)
    }, [])

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center space-y-4">
                <div className="h-16 w-16 rounded-xl bg-red-600 flex items-center justify-center animate-spin shadow-lg mx-auto">
                    <div className="h-8 w-8 border-4 border-white border-t-transparent rounded-full"></div>
                </div>
                <h1 className="text-2xl font-black uppercase text-slate-900">Clearing Session...</h1>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    Please wait while we refresh your authentication
                </p>
            </div>
        </div>
    )
}
