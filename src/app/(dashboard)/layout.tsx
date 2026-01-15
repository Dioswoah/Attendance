"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
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
    Flame
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
        { href: "/admin/history", label: "History", icon: History },
        { href: "/admin/reports", label: "Export", icon: FileText },
        { href: "/admin/settings", label: "Settings", icon: Settings },
    ]

    return (
        <div className="flex min-h-screen w-full bg-slate-50">
            {/* Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col bg-white border-r border-slate-100 sm:flex">
                <div className="flex h-20 items-center px-8 border-b border-slate-50">
                    <Link href="/admin" className="flex items-center gap-2.5 group">
                        <div className="h-9 w-9 bg-red-600 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
                            <Flame className="h-5 w-5 text-white fill-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-black italic uppercase tracking-tighter text-slate-900 leading-none">Redadair</span>
                            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-red-600 mt-0.5">Admin Portal</span>
                        </div>
                    </Link>
                </div>

                <nav className="flex flex-col gap-1 p-5">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link key={item.href} href={item.href}>
                                <Button
                                    variant="ghost"
                                    className={`w-full justify-start h-11 rounded-xl gap-3 px-4 transition-all duration-200 group ${isActive
                                        ? "bg-red-50 text-red-600 font-black border border-red-100/50"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                >
                                    <item.icon className={`h-4.5 w-4.5 ${isActive ? "text-red-600" : "text-slate-400 group-hover:text-slate-900"}`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-widest italic flex-1 text-left ${isActive ? "text-red-600" : "text-slate-500 group-hover:text-slate-900"}`}>
                                        {item.label}
                                    </span>
                                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-red-600" />}
                                </Button>
                            </Link>
                        )
                    })}
                </nav>

                <div className="mt-auto p-5 border-t border-slate-50">
                    <Button
                        variant="ghost"
                        className="w-full justify-start h-12 rounded-xl gap-3 px-4 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all font-bold uppercase italic tracking-widest text-[9px] group"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4" />
                        Logout Session
                    </Button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 sm:pl-64 min-h-screen">
                <header className="sticky top-0 z-40 flex h-16 items-center justify-between px-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        {/* Empty or can add breadcrumbs later */}
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col text-right">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 leading-none group-hover:text-red-600 transition-colors">Administrator</span>
                            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mt-1">Status: Authorized</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-10">
                    {children}
                </main>
            </div>
        </div>
    )
}
