"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { Flame, LayoutDashboard, CalendarDays, FileText, Menu, X, Users, ChevronLeft, ChevronRight, LogOut, Clock, Edit, Settings, Globe, Shield, History, Building2, ListChecks, TrendingUp, Download, FilePlus2, Fingerprint, HardHat } from "lucide-react"
import { NotificationBell } from "@/components/NotificationBell"
import { PatchNotesModal } from "@/components/PatchNotesModal"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { RisaChatbot } from "@/components/RisaChatbot"
import { UserOnboardingTour } from "@/components/UserOnboardingTour"

import { toast } from "sonner"
import { isActionLocked } from "@/lib/actionLock"
import { TimezoneSettings } from "@/components/TimezoneSettings"
import { ScrollIndicator } from "@/components/ScrollIndicator"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { ManagerNotificationSettings } from "@/components/ManagerNotificationSettings"
import { ProfileSettings } from "@/components/ProfileSettings"

export default function UserLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4"><div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center shadow-xl mx-auto overflow-hidden"><img src="/logo.png" alt="Logo" className="w-full h-full object-contain" /></div><p className="text-xs font-black uppercase text-sidebar-foreground/50">Loading...</p></div>}>
            <UserLayoutInner>{children}</UserLayoutInner>
        </Suspense>
    )
}

function UserLayoutInner({
    children,
}: {
    children: React.ReactNode
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
    const [pendingLeaveCount, setPendingLeaveCount] = useState(0)
    const [pendingAmendCount, setPendingAmendCount] = useState(0)
    const [managerPendingCount, setManagerPendingCount] = useState(0)
    const [managerPendingLeaves, setManagerPendingLeaves] = useState(0)
    const [managerPendingAttn, setManagerPendingAttn] = useState(0)
    const [isNavBlocked, setIsNavBlocked] = useState(false)
    const actionOverlayRef = useRef<HTMLDivElement>(null)
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { data: session, status } = useSession()

    // Determine user roles
    const userRoles = (session?.user as any)?.roles || []
    const isDeveloper = userRoles.includes('DEVELOPER')
    const isManagerOrAdmin = isDeveloper || userRoles.includes('MANAGER') || userRoles.includes('ADMIN') || userRoles.includes('VIEWER')
    // Technicians board: strictly OPERATIONS (plus admins/developers) — NOT managers.
    const canSeeTechnicians = isDeveloper || userRoles.includes('ADMIN') || userRoles.includes('OPERATIONS')

    // Fetch pending counts
    const fetchCounts = async () => {
        if (!session?.user?.id) return
        try {
            // Fetch My Pending Leaves
            const leaveRes = await fetch(`/api/leaves?userId=${session.user.id}&status=PENDING`)
            if (leaveRes.ok) {
                const leaves = await leaveRes.json()
                const pending = Array.isArray(leaves) ? leaves.filter((l: any) => l.status === 'PENDING' && !l.isArchived) : []
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
                        if (r.isArchived) return false

                        // Removed hidden logic for cascaded requests to match Amend Records page
                        return true

                    })
                    setPendingAmendCount(filteredReqs.length)
                } else {
                    setPendingAmendCount(0)
                }
            }

            // Fetch Manager Pending Requests (if user is manager/admin)
            if (isManagerOrAdmin) {
                try {
                    const [managerLeavesRes, managerAttnRes] = await Promise.all([
                        fetch(`/api/leaves?managerId=${session.user.id}&status=PENDING`),
                        fetch(`/api/attendance-requests?managerId=${session.user.id}&status=PENDING`)
                    ])

                    let totalManagerPending = 0
                    let leavesCount = 0
                    let attnCount = 0

                    if (managerLeavesRes.ok) {
                        const leaves = await managerLeavesRes.json()
                        leavesCount = Array.isArray(leaves) ? leaves.filter((l: any) => l.status === 'PENDING').length : 0
                        totalManagerPending += leavesCount
                    }

                    if (managerAttnRes.ok) {
                        const reqs = await managerAttnRes.json()
                        attnCount = Array.isArray(reqs) ? reqs.filter((r: any) => r.status === 'PENDING').length : 0
                        totalManagerPending += attnCount
                    }

                    setManagerPendingCount(totalManagerPending)
                    setManagerPendingLeaves(leavesCount)
                    setManagerPendingAttn(attnCount)
                } catch (error) {
                    console.error("Failed to fetch manager pending counts", error)
                }
            }
        } catch (error) {
            console.error("Failed to fetch sidebar counts", error)
        }
    }

    // Poll Google Status to keep DB in sync
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

    // Block all interaction while an attendance action is processing
    useEffect(() => {
        const handler = (e: Event) => {
            const locked = (e as CustomEvent<{ locked: boolean }>).detail.locked
            // Direct DOM update — no React re-render lag
            if (actionOverlayRef.current) {
                actionOverlayRef.current.style.display = locked ? 'block' : 'none'
            }
            setIsNavBlocked(locked)
        }
        window.addEventListener('attendance-action-lock', handler)
        return () => window.removeEventListener('attendance-action-lock', handler)
    }, [])

    const handleBlockedNav = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        toast.warning("Please wait — your attendance is currently being recorded. If the buttons don't update, please reload the app.", { duration: 3500 })
    }, [])

    // Dynamic navigation items based on role
    const navItems = [
        { name: "Dashboard", href: "/user", icon: LayoutDashboard },
        { name: "Leave Requests", href: "/user/leaves", icon: CalendarDays, badge: pendingLeaveCount },
        { name: "Amend Records", href: "/user/amend-records", icon: Edit, badge: pendingAmendCount },
        { name: "Activity Logs", href: "/user/activity", icon: FileText },
        ...((session?.user as any)?.location === 'Philippines' ? [{ name: "Biometric Records", href: "/user/biometric", icon: Fingerprint }] : []),
        ...(isManagerOrAdmin ? [{
            name: "Manager Control",
            href: "/user/manager",
            icon: Users,
            badge: managerPendingCount,
            subItems: [
                { name: "Pending Requests", href: "/user/manager?tab=requests", icon: ListChecks, badge: managerPendingLeaves + managerPendingAttn },
                { name: "History", href: "/user/manager?tab=history", icon: History },
                { name: "Calendar", href: "/user/manager?tab=calendar", icon: CalendarDays },
                { name: "Performance", href: "/user/manager?tab=performance", icon: TrendingUp },
                { name: "Reports", href: "/user/manager?tab=reports", icon: Download },
                { name: "Grant Leave", href: "/user/manager?tab=grant-leave", icon: FilePlus2 }
            ]
        }] : []),
        ...(canSeeTechnicians ? [{
            name: "Technicians",
            href: "/user/technicians",
            icon: HardHat
        }] : []),
        ...((isDeveloper || userRoles.includes('ADMIN')) ? [{
            name: "Admin Portal",
            href: "/admin",
            icon: Shield
        }] : [])
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
    const userRole = isDeveloper ? 'Developer'
        : userRoles.includes('ADMIN') ? 'Admin'
        : userRoles.includes('MANAGER') ? 'Manager'
        : userRoles.includes('OPERATIONS') ? 'Operations'
        : userRoles.includes('VIEWER') ? 'Viewer'
        : 'Staff'

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-red-100 selection:text-red-900 w-full relative overflow-x-hidden">
            <PatchNotesModal isAdmin={isManagerOrAdmin} isDeveloper={isDeveloper} />
            {/* Soft background glow */}
            <div className="fixed top-0 left-0 h-[500px] w-[500px] bg-red-100/30 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            <aside className={cn(
                "hidden lg:flex flex-col bg-sidebar bg-[linear-gradient(to_bottom,_var(--sidebar),_rgba(0,0,0,0.05))] backdrop-blur-xl border-sidebar-border fixed inset-y-0 left-0 z-40 transition-all duration-300 shadow-2xl",
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
                <nav className="flex-1 min-h-0 p-4 space-y-2 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href || (item.subItems?.some(sub => pathname + (window?.location?.search || '') === sub.href))
                        const hasSubItems = item.subItems && item.subItems.length > 0
                        const isCurrentlyExpanded = expandedMenus[item.name] !== undefined ? expandedMenus[item.name] : (isActive && hasSubItems)
                        const isExpanded = !sidebarCollapsed && isCurrentlyExpanded

                        return (
                            <div key={item.href} className="space-y-1">
                                <Link
                                    href={item.href}
                                    onClick={(e) => {
                                        if (isActionLocked()) { handleBlockedNav(e); return; }
                                        if (hasSubItems) {
                                            e.preventDefault();
                                            setExpandedMenus(prev => ({
                                                ...prev,
                                                [item.name]: !isCurrentlyExpanded
                                            }));
                                        }
                                    }}
                                    className={cn(
                                        "flex items-center gap-3 px-3 h-10 rounded-lg font-medium text-sm transition-all duration-200 relative",
                                        isActive && !hasSubItems
                                            ? "bg-[#D4A056] text-primary-foreground font-semibold shadow-sm"
                                            : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground",
                                        sidebarCollapsed && "justify-center px-0 h-10 w-10 mx-auto",
                                        isActive && hasSubItems && !sidebarCollapsed && "text-white font-bold",
                                        isNavBlocked && "cursor-not-allowed opacity-60"
                                    )}
                                >
                                    <Icon className={cn("h-5 w-5 shrink-0", isActive ? (hasSubItems ? "text-white" : "text-primary-foreground") : "text-sidebar-foreground/70")} />
                                    {!sidebarCollapsed && (
                                        <span className="flex-1">{item.name}</span>
                                    )}
                                    {item.badge ? (
                                        sidebarCollapsed ? (
                                            <div className="absolute top-0 right-0 h-3 w-3 rounded-full bg-white border-2 border-transparent" />
                                        ) : (
                                            <span className="bg-white text-red-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm mr-1">
                                                {item.badge}
                                            </span>
                                        )
                                    ) : null}
                                    {hasSubItems && !sidebarCollapsed && (
                                        <ChevronRight className={cn(
                                            "h-4 w-4 shrink-0 transition-transform duration-200 text-sidebar-foreground/50",
                                            isExpanded ? "rotate-90" : ""
                                        )} />
                                    )}
                                </Link>

                                {isExpanded && !sidebarCollapsed && (
                                    <div className="ml-4 pl-4 border-l border-white/10 space-y-1 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {item.subItems?.map((sub) => {
                                            const SubIcon = sub.icon
                                            const subHref = sub.href
                                            // Extract tab from subHref if it exists
                                            const subTab = subHref.split('tab=')[1]

                                            // Handle active state accurately via searchParams
                                            const currentTab = searchParams ? searchParams.get('tab') : null;
                                            const isSubActive = (pathname === subHref.split('?')[0]) &&
                                                (currentTab === subTab || (!currentTab && subTab === 'requests'))

                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    onClick={(e) => { if (isActionLocked()) handleBlockedNav(e) }}
                                                    className={cn(
                                                        "flex items-center gap-3 px-3 h-9 rounded-lg font-medium text-[11px] uppercase tracking-wider transition-all duration-200 relative",
                                                        isSubActive
                                                            ? "bg-white/10 text-white font-bold shadow-inner border border-white/5"
                                                            : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-white/5",
                                                        isNavBlocked && "cursor-not-allowed opacity-60"
                                                    )}
                                                >
                                                    <SubIcon className="h-3.5 w-3.5" />
                                                    <span className="flex-1">{sub.name}</span>
                                                    {sub.badge ? (
                                                        <span className="bg-white text-red-900 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                                                            {sub.badge}
                                                        </span>
                                                    ) : null}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </nav>

                {/* User Profile Section & Footer */}
                <div className="mt-auto border-t border-white/10 bg-black/10 backdrop-blur-sm">
                    <div className="p-4">
                        <div className={cn(
                            "flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/10 transition-all hover:bg-white/10 group",
                            sidebarCollapsed && "flex-col justify-center items-center p-2 gap-2"
                        )}>
                            <div className="relative shrink-0">
                                <Avatar className="w-10 h-10 border-2 border-white/20 shadow-md">
                                    {session?.user?.image ? (
                                        <img src={session.user.image} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        <AvatarFallback className="bg-white text-[#8B2323] text-sm font-black">
                                            {getInitials(session?.user?.name)}
                                        </AvatarFallback>
                                    )}
                                </Avatar>
                            </div>

                            {!sidebarCollapsed && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-white truncate leading-tight tracking-tight">{displayName}</p>
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.1em] mt-0.5">{userRole}</p>
                                </div>
                            )}

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button id="tour-sidebar-settings" variant="ghost" size="icon" className="text-white/40 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 transition-all shrink-0">
                                        <Settings className="w-4 h-4 transition-transform group-hover:rotate-45" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    side="right"
                                    sideOffset={12}
                                    className="w-72 rounded-[1.5rem] p-2 bg-white/95 backdrop-blur-md shadow-2xl border-slate-100 animate-in fade-in slide-in-from-left-2 duration-200"
                                >
                                    <div className="px-3 py-3 border-b border-slate-50 mb-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Settings & Preferences</p>
                                    </div>

                                    <ProfileSettings />
                                    <ManagerNotificationSettings />

                                    <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                                        <TimezoneSettings
                                            compact
                                            showLabel={false}
                                            trigger={
                                                <div className="flex items-center w-full px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-all cursor-pointer group">
                                                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-100 transition-colors">
                                                        <Globe className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 ml-3 overflow-hidden">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-slate-700">Display Timezone</span>
                                                            <div className="h-6 w-fit px-2 rounded-md bg-slate-50 flex items-center justify-center border border-slate-100 italic text-[10px] text-slate-400 group-hover:bg-white transition-colors">
                                                                {((session?.user as any)?.useCurrentTimezone || (session?.user as any)?.selectedTimezone === Intl.DateTimeFormat().resolvedOptions().timeZone)
                                                                    ? "Local"
                                                                    : ((session?.user as any)?.selectedTimezone || "UTC").split('/').pop()?.replace('_', ' ')}
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-medium truncate">Adjust time display preferences</p>
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator className="bg-slate-50 my-1" />

                                    <DropdownMenuItem
                                        onClick={() => signOut({ callbackUrl: '/' })}
                                        className="flex items-center gap-3 px-3 py-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all cursor-pointer group"
                                    >
                                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 group-hover:bg-slate-200 group-hover:text-slate-900 transition-colors">
                                            <LogOut className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold">Sign Out</span>
                                            <p className="text-[10px] text-slate-500 font-medium">End your session</p>
                                        </div>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {!sidebarCollapsed && (
                        <div className="px-6 pb-6 pt-2">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] text-center">
                                © 2024 Redadair
                            </p>
                        </div>
                    )}
                </div>
            </aside >

            {/* Mobile Sidebar Overlay */}
            {
                sidebarOpen && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />
                        <aside className="fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-200 z-50 lg:hidden animate-in slide-in-from-left duration-300 flex flex-col shadow-2xl">
                            {/* Mobile Logo */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
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
                            <nav className="flex-1 min-h-0 p-4 space-y-2 overflow-y-auto">
                                {navItems.map((item) => {
                                    const Icon = item.icon
                                    const isActive = pathname === item.href
                                    const hasSubItems = item.subItems && item.subItems.length > 0
                                    const isCurrentlyExpandedMobile = expandedMenus[item.name] !== undefined ? expandedMenus[item.name] : (isActive && hasSubItems);

                                    return (
                                        <div key={item.href} className="space-y-1">
                                            <Link
                                                href={item.href}
                                                onClick={(e) => {
                                                    if (isActionLocked()) { handleBlockedNav(e); return; }
                                                    if (hasSubItems) {
                                                        e.preventDefault();
                                                        setExpandedMenus(prev => ({
                                                            ...prev,
                                                            [item.name]: !isCurrentlyExpandedMobile
                                                        }));
                                                    } else {
                                                        setSidebarOpen(false);
                                                    }
                                                }}
                                                className={cn(
                                                    "flex items-center gap-4 px-4 h-14 rounded-xl font-bold text-sm uppercase tracking-wide transition-all duration-300 relative",
                                                    isActive && !hasSubItems
                                                        ? "bg-[#8B2323] text-white shadow-lg shadow-[#8B2323]/20"
                                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                                                    isNavBlocked && "cursor-not-allowed opacity-60"
                                                )}
                                            >
                                                <Icon className="h-6 w-6" />
                                                <span className="text-xs font-black tracking-widest flex-1">{item.name}</span>
                                                {item.badge ? (
                                                    <span className="bg-red-100/80 text-red-900 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm mr-1">
                                                        {item.badge}
                                                    </span>
                                                ) : null}
                                                {hasSubItems && (
                                                    <ChevronRight className={cn(
                                                        "h-4 w-4 shrink-0 transition-transform duration-200 text-slate-400",
                                                        isCurrentlyExpandedMobile ? "rotate-90" : ""
                                                    )} />
                                                )}
                                            </Link>

                                            {isCurrentlyExpandedMobile && (
                                                <div className="ml-6 pl-4 border-l-2 border-slate-100 space-y-2 py-2 animate-in fade-in slide-in-from-top-1">
                                                    {item.subItems?.map((sub) => {
                                                        const SubIcon = sub.icon
                                                        const subTab = sub.href.split('tab=')[1]
                                                        const currentTab = searchParams ? searchParams.get('tab') : null;
                                                        const isSubActive = (pathname === sub.href.split('?')[0]) &&
                                                            (currentTab === subTab || (!currentTab && subTab === 'requests'));

                                                        return (
                                                            <Link
                                                                key={sub.href}
                                                                href={sub.href}
                                                                onClick={(e) => {
                                                                    if (isActionLocked()) { handleBlockedNav(e); return; }
                                                                    setSidebarOpen(false)
                                                                }}
                                                                className={cn(
                                                                    "flex items-center gap-3 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all w-full",
                                                                    isSubActive
                                                                        ? "bg-red-50 text-red-700"
                                                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                                                                    isNavBlocked && "cursor-not-allowed opacity-60"
                                                                )}
                                                            >
                                                                <SubIcon className="h-4 w-4" />
                                                                <span className="flex-1">{sub.name}</span>
                                                                {sub.badge ? (
                                                                    <span className="bg-red-50 text-red-600 border border-red-100 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                                        {sub.badge}
                                                                    </span>
                                                                ) : null}
                                                            </Link>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
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
                                <div className="grid grid-cols-2 gap-2 w-full">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full h-12 gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 border-slate-200"
                                            >
                                                <Settings className="w-4 h-4" />
                                                <span>Settings</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="center"
                                            side="top"
                                            sideOffset={12}
                                            className="w-72 rounded-[1.5rem] p-2 bg-white/95 backdrop-blur-md shadow-2xl border-slate-100 animate-in fade-in zoom-in-95 duration-200"
                                        >
                                            <div className="px-3 py-3 border-b border-slate-50 mb-1">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Settings & Preferences</p>
                                            </div>

                                            <ProfileSettings />
                                            <ManagerNotificationSettings />

                                            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                                                <TimezoneSettings
                                                    compact
                                                    showLabel={false}
                                                    trigger={
                                                        <div className="flex items-center w-full px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-all cursor-pointer group">
                                                            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-100 transition-colors">
                                                                <Globe className="w-4 h-4" />
                                                            </div>
                                                            <div className="flex-1 ml-3 overflow-hidden">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-bold text-slate-700">Display Timezone</span>
                                                                    <div className="h-6 w-fit px-2 rounded-md bg-slate-50 flex items-center justify-center border border-slate-100 italic text-[10px] text-slate-400 group-hover:bg-white transition-colors">
                                                                        {((session?.user as any)?.useCurrentTimezone || (session?.user as any)?.selectedTimezone === Intl.DateTimeFormat().resolvedOptions().timeZone)
                                                                            ? "Local"
                                                                            : ((session?.user as any)?.selectedTimezone || "UTC").split('/').pop()?.replace('_', ' ')}
                                                                    </div>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 font-medium truncate">Adjust time display preferences</p>
                                                            </div>
                                                        </div>
                                                    }
                                                />
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    <Button
                                        variant="ghost"
                                        onClick={() => signOut({ callbackUrl: '/' })}
                                        className="w-full h-12 gap-2 text-[10px] font-black uppercase tracking-widest text-[#8B2323] hover:text-white hover:bg-[#8B2323] rounded-xl transition-colors border border-transparent hover:border-[#8B2323]"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Sign Out</span>
                                    </Button>
                                </div>
                            </div>
                        </aside>
                    </>
                )
            }

            {/* Main Content Area */}
            <div className={cn(
                "flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden transition-all duration-300",
                sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"
            )}>
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
                        <div id="topbar-clock-container-mobile"></div>
                        <div id="topbar-activity-container-mobile"></div>
                        <UserOnboardingTour mode="trigger" />
                        <NotificationBell />
                    </div>
                </header>

                {/* Desktop Header */}
                <header className="hidden lg:flex bg-white border-b border-border px-4 lg:px-8 py-4 items-center justify-between gap-4 sticky top-0 z-30">
                    <div className="flex items-center flex-1">
                        <Breadcrumbs />
                    </div>

                    <div id="topbar-clock-container-desktop" className="flex items-center justify-center flex-1"></div>

                    <div className="flex items-center justify-end flex-1 gap-4">
                        <div id="topbar-activity-container-desktop"></div>
                        <UserOnboardingTour mode="trigger" />
                        <NotificationBell />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 flex flex-col relative z-10 p-4 lg:p-8 w-full min-w-0">
                    {children}
                </main>
            </div>
            {/* Transparent overlay — blocks all clicks while an attendance action is in flight */}
            <div
                ref={actionOverlayRef}
                style={{ display: 'none' }}
                className="fixed inset-0 z-[9999] cursor-not-allowed"
                onClick={handleBlockedNav}
            />
            <RisaChatbot />
            <ScrollIndicator variant="maroon" offset="bottom-24" />
            <UserOnboardingTour mode="logic" />
        </div >
    )
}
