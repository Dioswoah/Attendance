"use client"

import { useState, useEffect } from "react"
import { Flame, LayoutDashboard, CalendarDays, FileText, Menu, X, Users, ChevronLeft, ChevronRight, LogOut, Clock, Edit } from "lucide-react"
import { NotificationBell } from "@/components/NotificationBell"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { RisaChatbot } from "@/components/RisaChatbot"
import { UserOnboardingTour } from "@/components/UserOnboardingTour"

import { TimezoneSettings } from "@/components/TimezoneSettings"
import { ScrollIndicator } from "@/components/ScrollIndicator"
import { Breadcrumbs } from "@/components/Breadcrumbs"

export default function UserLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [pendingLeaveCount, setPendingLeaveCount] = useState(0)
    const [pendingAmendCount, setPendingAmendCount] = useState(0)
    const pathname = usePathname()
    const { data: session, status } = useSession()

    // Determine user roles
    const userRoles = (session?.user as any)?.roles || []
    const isManagerOrAdmin = userRoles.includes('MANAGER') || userRoles.includes('ADMIN')

    // Fetch pending counts
    const fetchCounts = async () => {
        if (!session?.user?.id) return
        try {
            // Fetch My Pending Leaves
            const leaveRes = await fetch(`/api/leaves?userId=${session.user.id}&status=PENDING`)
            if (leaveRes.ok) {
                const leaves = await leaveRes.json()
                const pending = Array.isArray(leaves) ? leaves.filter((l: any) => l.status === 'PENDING') : []
                setPendingLeaveCount(pending.length)
            }

            // Fetch My Pending Attendance Requests
            const attnRes = await fetch(`/api/attendance-requests?userId=${session.user.id}&status=PENDING`)
            if (attnRes.ok) {
                const reqs = await attnRes.json()
                if (Array.isArray(reqs)) {
                    // Count total pending requests
                    const filteredReqs = reqs.filter((r: any) => {
                        if (r.status !== 'PENDING') return false

                        // Removed hidden logic for cascaded requests to match Amend Records page
                        return true

                    })
                    setPendingAmendCount(filteredReqs.length)
                } else {
                    setPendingAmendCount(0)
                }
            }
        } catch (error) {
            console.error("Failed to fetch sidebar counts", error)
        }
    }

    useEffect(() => {
        fetchCounts()

        // Initialize Realtime Server-Sent Events for Global Sidebar Updates
        let eventSource: EventSource | null = null;
        if (typeof EventSource !== 'undefined' && session?.user?.id) {
            eventSource = new EventSource('/api/stream');
            eventSource.onmessage = (event) => {
                if (event.data === ': heartbeat' || event.data.includes('connected')) return;
                try {
                    const payload = JSON.parse(event.data);
                    // Refresh counts if attendance or leaves change anywhere
                    if (payload.type === 'attendance' || payload.type === 'leaves') {
                        fetchCounts();
                    }
                } catch (e) {
                    // Silently fail parse
                }
            };
        }

        return () => {
            if (eventSource) eventSource.close();
        }
    }, [session?.user?.id])

    // Dynamic navigation items based on role
    const navItems = [
        { name: "Dashboard", href: "/user", icon: LayoutDashboard },
        { name: "Leave Requests", href: "/user/leaves", icon: CalendarDays, badge: pendingLeaveCount },
        { name: "Amend Records", href: "/user/amend-records", icon: Edit, badge: pendingAmendCount },
        { name: "Activity Logs", href: "/user/activity", icon: FileText },
        ...(isManagerOrAdmin ? [{ name: "Manager Control", href: "/user/manager", icon: Users }] : []),
    ]

    // Wait for session to load to prevent hydration errors
    if (status === "loading") {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center animate-bounce shadow-xl mx-auto overflow-hidden">
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
                        <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-105 overflow-hidden">
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
                                    "flex items-center gap-3 px-3 h-10 rounded-lg font-medium text-sm transition-all duration-200 relative",
                                    isActive
                                        ? "bg-[#D4A056] text-primary-foreground font-semibold shadow-sm"
                                        : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground",
                                    sidebarCollapsed && "justify-center px-0 h-10 w-10 mx-auto"
                                )}
                            >
                                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground" : "text-sidebar-foreground/70")} />
                                {!sidebarCollapsed && (
                                    <span className="flex-1">{item.name}</span>
                                )}
                                {item.badge ? (
                                    sidebarCollapsed ? (
                                        <div className="absolute top-0 right-0 h-3 w-3 rounded-full bg-white border-2 border-transparent" />
                                    ) : (
                                        <span className="bg-white text-red-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                            {item.badge}
                                        </span>
                                    )
                                ) : null}
                            </Link>
                        )
                    })}
                </nav>

                {/* User Profile Section */}
                <div className="p-4 border-t border-white/5 mt-auto">
                    <div className={cn(
                        "flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm transition-all hover:bg-white/10 group",
                        sidebarCollapsed && "justify-center p-2"
                    )}>
                        <div className="relative shrink-0">
                            <Avatar className="w-12 h-12 border-2 border-white/10 shadow-lg transition-transform group-hover:scale-105">
                                {session?.user?.image ? (
                                    <img src={session.user.image} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <AvatarFallback className="bg-white text-[#8B2323] text-base font-black">
                                        {getInitials(session?.user?.name)}
                                    </AvatarFallback>
                                )}
                            </Avatar>
                        </div>

                        {!sidebarCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold text-white truncate leading-tight tracking-tight">{displayName}</p>
                                <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.1em] mt-0.5">{userRole}</p>
                            </div>
                        )}
                    </div>

                    <Button
                        variant="ghost"
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className={cn(
                            "w-full justify-start h-10 gap-3 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/5 rounded-lg transition-colors mt-2",
                            sidebarCollapsed && "justify-center px-0"
                        )}
                    >
                        <LogOut className="w-5 h-5 shrink-0" />
                        {!sidebarCollapsed && <span>Sign Out</span>}
                    </Button>
                </div>

                {/* Footer */}
                {
                    !sidebarCollapsed && (
                        <div className="p-4 border-sidebar-border">
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] text-center">
                                © 2024 Redadair
                            </p>
                        </div>
                    )
                }
            </aside >

            {/* Mobile Sidebar Overlay */}
            {
                sidebarOpen && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />
                        <aside className="fixed left-0 top-0 bottom-0 w-72 bg-white border-sidebar-border z-50 lg:hidden animate-in slide-in-from-left duration-300">
                            {/* Mobile Logo */}
                            <div className="p-6 border-sidebar-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-red-50 overflow-hidden">
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
                                                "flex items-center gap-4 px-4 h-14 rounded-xl font-bold text-sm uppercase tracking-wide transition-all duration-300 relative",
                                                isActive
                                                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-lg shadow-sidebar-accent/20"
                                                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
                                            )}
                                        >
                                            <Icon className="h-6 w-6" />
                                            <span className="text-xs font-black tracking-widest flex-1">{item.name}</span>
                                            {item.badge ? (
                                                <span className="bg-red-100/80 text-red-900 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                    {item.badge}
                                                </span>
                                            ) : null}
                                        </Link>
                                    )
                                })}
                            </nav>

                            {/* Mobile User Profile Section */}
                            <div className="p-4 border-t border-slate-100 mt-auto bg-white/50">
                                <div className="flex items-center gap-4 p-4 rounded-[2rem] bg-white border border-slate-100 mb-4 shadow-sm group">
                                    <div className="relative shrink-0">
                                        <Avatar className="w-14 h-14 border-2 border-white shadow-xl transition-transform group-hover:scale-105">
                                            {session?.user?.image ? (
                                                <img src={session.user.image} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                <AvatarFallback className="bg-[#8B2323] text-white text-xl font-black">
                                                    {getInitials(session?.user?.name)}
                                                </AvatarFallback>
                                            )}
                                        </Avatar>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-black text-slate-900 truncate tracking-tight leading-none">{displayName}</p>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-1.5">{userRole}</p>
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
                )
            }

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
                        <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-md overflow-hidden">
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
                        <UserOnboardingTour mode="trigger" />

                        <NotificationBell />
                    </div>
                </header>

                {/* Desktop Header */}
                <header className="hidden lg:flex bg-white border-b border-border px-4 lg:px-8 py-4 items-center justify-between gap-4 sticky top-0 z-30">
                    <div className="flex items-center">
                        <Breadcrumbs />
                    </div>

                    <div className="flex items-center gap-4">
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
                        <TimezoneSettings />
                        <UserOnboardingTour mode="trigger" />
                        <NotificationBell />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 flex flex-col relative z-10 p-4 lg:p-8">
                    {children}
                </main>
            </div>
            <RisaChatbot />
            <ScrollIndicator variant="maroon" offset="bottom-24" />
            <UserOnboardingTour mode="logic" />
        </div >
    )
}
