"use client"

import { useState } from "react"
import { Flame, LayoutDashboard, CalendarDays, FileText, Menu, X, Users, ChevronLeft, ChevronRight, LogOut, Clock, Edit } from "lucide-react"
import { NotificationBell } from "@/components/NotificationBell"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"

export default function UserLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const pathname = usePathname()
    const { data: session, status } = useSession()

    // Determine user roles
    const userRoles = (session?.user as any)?.roles || []
    const isManagerOrAdmin = userRoles.includes('MANAGER') || userRoles.includes('ADMIN')

    // Dynamic navigation items based on role
    const navItems = [
        { name: "Dashboard", href: "/user", icon: LayoutDashboard },
        { name: "Leave Requests", href: "/user/leaves", icon: CalendarDays },
        { name: "Amend Records", href: "/user/amend-records", icon: Edit },
        { name: "Activity Logs", href: "/user/activity", icon: FileText },
        ...(isManagerOrAdmin ? [{ name: "Manager Control", href: "/user/manager", icon: Users }] : []),
    ]

    // Wait for session to load to prevent hydration errors
    if (status === "loading") {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center animate-bounce shadow-xl mx-auto p-2">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-sidebar-foreground/50">Loading...</p>
                </div>
            </div>
        )
    }

    // If not authenticated, show children (which will handle redirect)
    if (!session) {
        return <>{children}</>
    }

    const getInitials = (name?: string | null) => {
        if (!name) return "U"
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    const displayName = session?.user?.name || "User"
    const userRole = isManagerOrAdmin
        ? (userRoles.includes('ADMIN') ? 'Admin' : 'Manager')
        : 'Staff'

    return (
        <div className="min-h-screen bg-background flex font-sans selection:bg-red-100 selection:text-red-900">
            {/* Soft background glow */}
            <div className="fixed top-0 left-0 h-[500px] w-[500px] bg-red-100/30 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            {/* Sidebar - Desktop */}
            <aside className={cn(
                "hidden lg:flex flex-col bg-sidebar backdrop-blur-xl border-sidebar-border sticky top-0 h-screen z-40 transition-all duration-300",
                sidebarCollapsed ? "w-20" : "w-72"
            )}>
                {/* Logo */}
                <div className="p-6 border-sidebar-border relative">
                    <div className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center")}>
                        <div className="h-11 w-11 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-md p-1.5 transition-transform hover:scale-105">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex flex-col">
                                <span className="text-lg font-bold text-sidebar-foreground tracking-tight leading-none">Redadair</span>
                                <span className="text-xs font-medium text-sidebar-foreground/60">Staff Availability</span>
                            </div>
                        )}
                    </div>

                    {/* Toggle Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -right-4 top-8 w-8 h-8 rounded-full bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-600 shadow-sm z-50"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    >
                        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 h-10 rounded-lg font-medium text-sm transition-all duration-200",
                                    isActive
                                        ? "bg-[#D4A056] text-primary-foreground font-semibold shadow-sm"
                                        : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground",
                                    sidebarCollapsed && "justify-center px-0 h-10 w-10 mx-auto"
                                )}
                            >
                                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground" : "text-sidebar-foreground/70")} />
                                {!sidebarCollapsed && <span>{item.name}</span>}
                            </Link>
                        )
                    })}
                </nav>

                {/* User Profile */}
                <div className="p-4 border-sidebar-border">
                    <div className={cn("flex flex-col gap-3", sidebarCollapsed && "items-center")}>
                        <div className={cn(
                            "flex items-center gap-4 p-3 rounded-xl bg-slate-100/50",
                            sidebarCollapsed && "justify-center p-2"
                        )}>
                            <Avatar className="w-12 h-12 shrink-0">
                                {session?.user?.image ? (
                                    <img src={session.user.image} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <AvatarFallback className="bg-slate-900 text-white text-base font-black italic">
                                        {getInitials(session?.user?.name)}
                                    </AvatarFallback>
                                )}
                            </Avatar>
                            {!sidebarCollapsed && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-sidebar-foreground truncate">{displayName}</p>
                                    <p className="text-xs text-sidebar-foreground/60">{userRole}</p>
                                </div>
                            )}
                        </div>

                        <Button
                            variant="ghost"
                            onClick={() => signOut({ callbackUrl: '/' })}
                            className={cn(
                                "w-full justify-start h-10 gap-3 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/5 rounded-lg transition-colors",
                                sidebarCollapsed && "justify-center px-0"
                            )}
                        >
                            <LogOut className="w-5 h-5 shrink-0" />
                            {!sidebarCollapsed && <span>Sign Out</span>}
                        </Button>
                    </div>
                </div>

                {/* Footer */}
                {!sidebarCollapsed && (
                    <div className="p-4 border-sidebar-border">
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] text-center italic">
                            © 2024 Redadair
                        </p>
                    </div>
                )}
            </aside>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                    <aside className="fixed left-0 top-0 bottom-0 w-72 bg-white border-sidebar-border z-50 lg:hidden animate-in slide-in-from-left duration-300">
                        {/* Mobile Logo */}
                        <div className="p-6 border-sidebar-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-lg border border-red-50 p-2">
                                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-base font-black italic uppercase tracking-tighter text-slate-900 leading-none">Redadair</span>
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mt-0.5">Staff Portal</span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSidebarOpen(false)}
                                className="h-8 w-8"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Mobile Navigation */}
                        <nav className="flex-1 p-4 space-y-2">
                            {navItems.map((item) => {
                                const Icon = item.icon
                                const isActive = pathname === item.href
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setSidebarOpen(false)}
                                        className={cn(
                                            "flex items-center gap-4 px-4 h-14 rounded-xl font-bold text-sm uppercase tracking-wide transition-all duration-300",
                                            isActive
                                                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-lg shadow-sidebar-accent/20"
                                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
                                        )}
                                    >
                                        <Icon className="h-6 w-6" />
                                        <span className="text-xs font-black tracking-widest">{item.name}</span>
                                    </Link>
                                )
                            })}
                        </nav>

                        {/* Mobile User Profile */}
                        <div className="p-4 border-sidebar-border">
                            <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-100/50 mb-3">
                                <Avatar className="w-12 h-12">
                                    {session?.user?.image ? (
                                        <img src={session.user.image} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        <AvatarFallback className="bg-slate-900 text-white text-base font-black italic">
                                            {getInitials(session?.user?.name)}
                                        </AvatarFallback>
                                    )}
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black italic uppercase text-slate-900 truncate">{displayName}</p>
                                    <p className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-widest">{userRole}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => signOut({ callbackUrl: '/' })}
                                className="w-full h-12 gap-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl"
                            >
                                <LogOut className="w-5 h-5" />
                                <span>Sign Out</span>
                            </Button>
                        </div>
                    </aside>
                </>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Top Header - Mobile */}
                <header className="lg:hidden bg-white border-b border-border px-4 py-4 flex items-center justify-between sticky top-0 z-30">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarOpen(true)}
                        className="h-10 w-10"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-white rounded-lg flex items-center justify-center shadow-md p-1.5">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xs font-black italic uppercase tracking-tighter text-slate-900">Redadair</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {userRoles.includes('ADMIN') && (
                            <Link href="/admin">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white rounded-xl h-10 w-10"
                                >
                                    <LayoutDashboard className="h-4 w-4" />
                                </Button>
                            </Link>
                        )}
                        <NotificationBell />
                    </div>
                </header>

                {/* Desktop Header */}
                <header className="hidden lg:flex bg-white border-b border-border px-10 py-4 items-center justify-end gap-4 sticky top-0 z-30">
                    {userRoles.includes('ADMIN') && (
                        <Link href="/admin">
                            <Button
                                variant="outline"
                                className="bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-bold text-xs uppercase tracking-wide h-9"
                            >
                                <LayoutDashboard className="w-4 h-4 mr-2" />
                                ADMIN PORTAL
                            </Button>
                        </Link>
                    )}
                    <NotificationBell />
                </header>

                {/* Page Content */}
                <main className="flex-1 flex flex-col items-center relative z-10 p-6 lg:p-10">
                    {children}
                </main>
            </div>
        </div>
    )
}
