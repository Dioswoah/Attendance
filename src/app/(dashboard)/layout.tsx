"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/NotificationBell"
import {
    LayoutDashboard,
    Users,
    Building2,
    FileText,
    Settings,
    LogOut,
    Clock,
    History,
    ChevronRight,
    Flame,
    ShieldCheck
} from "lucide-react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        const isAuthenticated = sessionStorage.getItem("adminAuthenticated")
        if (!isAuthenticated) {
            router.push("/admin-login")
        }
    }, [router])

    const handleLogout = () => {
        sessionStorage.removeItem("adminAuthenticated")
        router.push("/admin-login")
    }

    const navItems = [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/employees", label: "Staff", icon: Users },
        { href: "/admin/departments", label: "Departments", icon: Building2 },
        { href: "/admin/manual-entry", label: "Manual Entry", icon: Clock },
        { href: "/admin/history", label: "Record", icon: History },
        { href: "/admin/manager-activity", label: "Manager Activity", icon: ShieldCheck },
        { href: "/admin/reports", label: "Export", icon: FileText },
        { href: "/admin/settings", label: "Settings", icon: Settings },
    ]

    return (
        <div className="flex min-h-screen w-full bg-muted/20">
            {/* Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col bg-white border-r border-border sm:flex">
                <div className="flex h-16 items-center px-6 border-b border-border">
                    <Link href="/admin" className="flex items-center gap-3 group">
                        <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
                            <Flame className="h-4 w-4 text-primary-foreground fill-primary-foreground" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-bold tracking-tight text-foreground leading-none">Redadair</span>
                            <span className="text-xs font-medium text-muted-foreground mt-0.5">Admin Portal</span>
                        </div>
                    </Link>
                </div>

                <nav className="flex flex-col gap-1 p-4">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link key={item.href} href={item.href}>
                                <Button
                                    variant="ghost"
                                    className={`w-full justify-start h-10 rounded-lg gap-3 px-3 transition-all duration-200 ${isActive
                                        ? "bg-primary/10 text-primary font-semibold"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        }`}
                                >
                                    <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                    <span className="text-sm font-medium flex-1 text-left">
                                        {item.label}
                                    </span>
                                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                                </Button>
                            </Link>
                        )
                    })}
                </nav>

                <div className="mt-auto p-4 border-t border-border">
                    <Button
                        variant="ghost"
                        className="w-full justify-start h-10 rounded-lg gap-3 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all font-medium text-sm"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4" />
                        Logout Session
                    </Button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 sm:pl-64 min-h-screen min-w-0">
                <header className="sticky top-0 z-40 flex h-16 items-center justify-between px-8 bg-white/80 backdrop-blur-md border-b border-border">
                    <div className="flex items-center gap-2">
                        {/* Empty or can add breadcrumbs later */}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col text-right">
                            <span className="text-sm font-semibold text-foreground leading-none">Administrator</span>
                            <span className="text-xs text-muted-foreground mt-0.5">Authorized</span>
                        </div>
                        <NotificationBell role="ADMIN" />
                    </div>
                </header>

                <main className="flex-1 p-8 min-w-0">
                    {children}
                </main>
            </div>
        </div>
    )
}
