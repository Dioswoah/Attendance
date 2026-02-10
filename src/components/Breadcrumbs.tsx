"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"
import { Fragment } from "react"
import { cn } from "@/lib/utils"

export function Breadcrumbs({ className }: { className?: string }) {
    const pathname = usePathname()

    // Split pathname into segments and remove empty strings
    const segments = pathname.split('/').filter(Boolean)

    // Map common path segments to readable labels
    const getLabel = (segment: string) => {
        // Special cases mapping
        const labels: Record<string, string> = {
            "admin": "Dashboard",
            "user": "Portal",
            "manual-entry": "Manual Entry",
            "manager-activity": "Manager Activity",
            "amend-records": "Amend Records",
            "force-signout": "Force Sign Out",
            "leaves": "Leave Requests"
        }

        // Return mapped label or capitalize first letter of each word
        return labels[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }

    // Generate crumbs
    const crumbs = segments.map((segment, index) => {
        // Construct path up to this segment
        const href = `/${segments.slice(0, index + 1).join('/')}`
        const isLast = index === segments.length - 1
        const label = getLabel(segment)

        return { href, label, isLast }
    })

    // Don't show breadcrumbs on root path (though typically we are in /admin or /user)
    if (crumbs.length === 0) return null

    return (
        <nav aria-label="Breadcrumb" className={cn("flex items-center", className)}>
            <div className="flex items-center text-sm text-muted-foreground/60">
                {/* Home Icon for Root (optional) */}
                {/* <Link href="/" className="hover:text-foreground transition-colors">
                    <Home className="h-4 w-4" />
                </Link>
                <ChevronRight className="h-4 w-4 mx-2" /> */}

                {crumbs.map((crumb, index) => (
                    <Fragment key={crumb.href}>
                        {index > 0 && (
                            <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground/40" />
                        )}

                        {crumb.isLast ? (
                            <span className="font-semibold text-foreground/90">
                                {crumb.label}
                            </span>
                        ) : (
                            <Link
                                href={crumb.href}
                                className="hover:text-primary hover:underline underline-offset-4 transition-colors font-medium text-muted-foreground/80"
                            >
                                {crumb.label}
                            </Link>
                        )}
                    </Fragment>
                ))}
            </div>
        </nav>
    )
}
