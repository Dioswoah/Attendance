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
    ShieldCheck,
    Loader2,
    BellRing,
    Fingerprint
} from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { TimezoneSettings } from "@/components/TimezoneSettings"
import { ScrollIndicator } from "@/components/ScrollIndicator"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from "@/components/ui/sheet"
import { Menu, X } from "lucide-react"

import { useSession } from "next-auth/react"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const { data: session, status } = useSession()

    const [isChecking, setIsChecking] = useState(true)

    useEffect(() => {
        if (status === "loading") return

        const roles = (session?.user as any)?.roles || []
        if (!roles.includes("ADMIN")) {
            router.push("/")
        } else {
            setIsChecking(false)
        }
    }, [status, session, router])

    // Poll Google Status to keep DB in sync (even for admins)
    useEffect(() => {
        if (!session?.user?.id) return

        const syncStatus = async () => {
            try {
                // Use POST as per our route definition
                await fetch('/api/user/status/sync', { method: 'POST' })
            } catch (e) {
                // Silent fail
            }
        }

        // Initial Sync
        syncStatus()

        // Poll every 60 seconds
        const interval = setInterval(syncStatus, 60000)

        // Also sync on window focus (user comes back to tab)
        const onFocus = () => syncStatus()
        window.addEventListener('focus', onFocus)

        return () => {
            clearInterval(interval)
            window.removeEventListener('focus', onFocus)
        }
    }, [session?.user?.id])

    if (isChecking) {
        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center bg-muted/20 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-red-600" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
                    Verifying Admin Access...
                </p>
            </div>
        )
    }

    const handleExit = () => {
        router.push("/user")
    }

    const navItems = [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/employees", label: "Staff", icon: Users },
        { href: "/admin/departments", label: "Departments", icon: Building2 },
        { href: "/admin/manual-entry", label: "Manual Entry", icon: Clock },
        { href: "/admin/history", label: "Record", icon: History },
        { href: "/admin/manager-activity", label: "Manager Activity", icon: ShieldCheck },
        { href: "/admin/biometric", label: "Biometric", icon: Fingerprint },
        { href: "/admin/reports", label: "Export", icon: FileText },
        { href: "/admin/notifications", label: "Notifications", icon: BellRing },
        { href: "/admin/settings", label: "Settings", icon: Settings },
    ]

    return (
        <div className="flex min-h-screen w-full bg-muted/20">
            {/* Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col bg-white border-r border-border sm:flex">
                <div className="flex h-16 items-center px-6 border-b border-border">
                    <Link href="/admin" className="flex items-center gap-3 group">
                        <div className="h-10 w-10 bg-white border border-border rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm overflow-hidden p-1">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
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
                        className="w-full justify-start h-10 rounded-lg gap-3 px-3 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all font-medium text-sm"
                        onClick={handleExit}
                    >
                        <LogOut className="h-4 w-4" />
                        Exit Admin Portal
                    </Button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 sm:pl-64 min-h-screen min-w-0">
                <header className="sticky top-0 z-40 flex h-16 items-center justify-between px-4 sm:px-8 bg-white/80 backdrop-blur-md border-b border-border">
                    <div className="flex items-center gap-2">
                        {/* Mobile Menu Trigger */}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="sm:hidden -ml-2 shrink-0">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-72 p-0 flex flex-col bg-white [&>button]:hidden">
                                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                                <div className="flex h-16 items-center px-6 border-b border-border justify-between sticky top-0 bg-white z-10 shrink-0">
                                    <Link href="/admin" className="flex items-center gap-3 group">
                                        <div className="h-10 w-10 bg-white border border-border rounded-xl flex items-center justify-center shadow-sm overflow-hidden p-1 shrink-0">
                                            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-base font-bold tracking-tight text-foreground leading-none truncate">Redadair</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5 truncate">Admin Portal</span>
                                        </div>
                                    </Link>
                                    <SheetClose asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 shrink-0">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </SheetClose>
                                </div>
                                <nav className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0">
                                    {navItems.map((item) => {
                                        const isActive = pathname === item.href
                                        return (
                                            <SheetClose asChild key={item.href}>
                                                <Link href={item.href}>
                                                    <Button
                                                        variant="ghost"
                                                        className={`w-full justify-start h-10 rounded-lg gap-3 px-3 transition-all duration-200 ${isActive
                                                            ? "bg-[#8B2323] text-white shadow-md font-bold uppercase tracking-wider text-xs"
                                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-bold uppercase tracking-wider text-xs"
                                                            }`}
                                                    >
                                                        <item.icon className="h-4 w-4 shrink-0" />
                                                        <span className="flex-1 text-left truncate">
                                                            {item.label}
                                                        </span>
                                                    </Button>
                                                </Link>
                                            </SheetClose>
                                        )
                                    })}
                                </nav>
                                <div className="mt-auto p-4 border-t border-border shrink-0 bg-white">
                                    <SheetClose asChild>
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start h-10 rounded-lg gap-3 px-3 text-red-600 hover:text-white hover:bg-red-600 transition-all font-bold text-xs uppercase tracking-wider"
                                            onClick={handleExit}
                                        >
                                            <LogOut className="h-4 w-4 shrink-0" />
                                            <span className="truncate">Exit Admin</span>
                                        </Button>
                                    </SheetClose>
                                </div>
                            </SheetContent>
                        </Sheet>
                        <Breadcrumbs />
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="hidden sm:flex flex-col text-right">
                            <span className="text-sm font-semibold text-foreground leading-none truncate">Administrator</span>
                            <span className="text-xs text-muted-foreground mt-0.5 truncate">Authorized</span>
                        </div>
                        <TimezoneSettings />
                        <NotificationBell role="ADMIN" />
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-8 min-w-0 w-full">
                    {children}
                </main>
                <ScrollIndicator variant="maroon" />
            </div>
        </div>
    )
}
