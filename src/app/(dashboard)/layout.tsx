"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
    LayoutDashboard,
    Users,
    Building2,
    FileText,
    Settings,
    LogOut,
    Clock,
    History
} from "lucide-react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()

    useEffect(() => {
        // Check if user is authenticated
        const isAuthenticated = sessionStorage.getItem("adminAuthenticated")
        if (!isAuthenticated) {
            router.push("/admin-login")
        }
    }, [router])

    const handleLogout = () => {
        sessionStorage.removeItem("adminAuthenticated")
        router.push("/admin-login")
    }

    return (
        <div className="flex min-h-screen w-full bg-muted/40">
            <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
                <div className="flex h-16 items-center border-b px-6">
                    <Link href="/admin" className="flex items-center gap-2 font-semibold">
                        <Clock className="h-6 w-6 text-primary" />
                        <span className="text-lg">Redadair Admin</span>
                    </Link>
                </div>
                <nav className="flex flex-col gap-2 p-4">
                    <Link href="/admin">
                        <Button variant="ghost" className="w-full justify-start gap-2">
                            <LayoutDashboard className="h-4 w-4" />
                            Dashboard
                        </Button>
                    </Link>
                    <Link href="/admin/employees">
                        <Button variant="ghost" className="w-full justify-start gap-2">
                            <Users className="h-4 w-4" />
                            Staff
                        </Button>
                    </Link>
                    <Link href="/admin/departments">
                        <Button variant="ghost" className="w-full justify-start gap-2">
                            <Building2 className="h-4 w-4" />
                            Departments
                        </Button>
                    </Link>
                    <Link href="/admin/manual-entry">
                        <Button variant="ghost" className="w-full justify-start gap-2">
                            <Clock className="h-4 w-4" />
                            Manual Entry
                        </Button>
                    </Link>
                    <Link href="/admin/history">
                        <Button variant="ghost" className="w-full justify-start gap-2">
                            <History className="h-4 w-4" />
                            History
                        </Button>
                    </Link>
                    <Link href="/admin/reports">
                        <Button variant="ghost" className="w-full justify-start gap-2">
                            <FileText className="h-4 w-4" />
                            Export
                        </Button>
                    </Link>
                    <Link href="/admin/settings">
                        <Button variant="ghost" className="w-full justify-start gap-2">
                            <Settings className="h-4 w-4" />
                            Settings
                        </Button>
                    </Link>
                </nav>
                <div className="mt-auto p-4 border-t">
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </aside>
            <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-64 w-full">
                <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                    <div className="flex items-center gap-4 ml-auto">
                        <span className="text-sm text-muted-foreground">Admin Portal</span>
                    </div>
                </header>
                <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
