"use client"

import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DebugPage() {
    const { data: session, status, update } = useSession()

    const handleForceRefresh = async () => {
        await update()
        window.location.reload()
    }

    const handleClearAndSignOut = async () => {
        await signOut({ callbackUrl: '/user' })
    }

    return (
        <div className="container mx-auto p-8 space-y-6">
            <h1 className="text-3xl font-black">Session Debug</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Current Session Data</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="bg-slate-100 p-4 rounded overflow-auto text-sm">
                        {JSON.stringify(session, null, 2)}
                    </pre>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>User Roles</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg mb-4">
                        Roles: <strong>{(session?.user as any)?.roles?.join(', ') || 'None'}</strong>
                    </p>
                    <p className="text-sm text-slate-600">
                        Has ADMIN: {(session?.user as any)?.roles?.includes('ADMIN') ? '✅ Yes' : '❌ No'}
                    </p>
                    <p className="text-sm text-slate-600">
                        Has MANAGER: {(session?.user as any)?.roles?.includes('MANAGER') ? '✅ Yes' : '❌ No'}
                    </p>
                </CardContent>
            </Card>

            <div className="flex gap-4">
                <Button onClick={handleForceRefresh} size="lg">
                    Force Refresh Session
                </Button>
                <Button onClick={handleClearAndSignOut} variant="destructive" size="lg">
                    Sign Out & Clear Session
                </Button>
            </div>
        </div>
    )
}
