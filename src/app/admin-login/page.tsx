"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminLoginPage() {
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const router = useRouter()

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault()

        if (password === "RedadairAdmin2024") {
            // Store login state in session storage
            sessionStorage.setItem("adminAuthenticated", "true")
            router.push("/admin")
        } else {
            setError("Incorrect password. Please try again.")
            setPassword("")
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto bg-purple-100 p-3 rounded-full w-fit">
                        <Lock className="h-8 w-8 text-purple-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900">Admin Portal</CardTitle>
                    <CardDescription>Enter password to access the admin dashboard</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter admin password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value)
                                    setError("")
                                }}
                                className={error ? "border-red-500" : ""}
                            />
                            {error && <p className="text-sm text-red-500">{error}</p>}
                        </div>
                        <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
                            Login
                        </Button>
                    </form>
                    <div className="text-center pt-4">
                        <Button variant="link" className="text-blue-600" asChild>
                            <a href="/user">Employee Portal</a>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
