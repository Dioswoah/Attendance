"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronUp as UpIcon } from "lucide-react"

interface ScrollIndicatorProps {
    offset?: string; // Tailwind class for bottom offset, e.g. "bottom-24"
    variant?: "primary" | "red" | "maroon";
}

export function ScrollIndicator({ offset, variant = "primary" }: ScrollIndicatorProps) {
    const [showTop, setShowTop] = useState(false)
    const observerRef = useRef<ResizeObserver | null>(null)

    const checkScroll = () => {
        const scrolled = window.scrollY || document.documentElement.scrollTop
        setShowTop(scrolled > 100)
    }

    useEffect(() => {
        // Events to listen for
        window.addEventListener("scroll", checkScroll, { passive: true })
        window.addEventListener("resize", checkScroll)

        // Initial check
        checkScroll()

        // Use ResizeObserver to detect content changes (like tab switching) instantly
        if (typeof ResizeObserver !== 'undefined') {
            observerRef.current = new ResizeObserver(() => {
                checkScroll()
            })
            // Observe the body for height changes
            observerRef.current.observe(document.body)
            // Also observe the document element
            observerRef.current.observe(document.documentElement)
        }

        // Keep a fallback interval but make it less frequent if observer is working
        const interval = setInterval(checkScroll, 1500)

        return () => {
            window.removeEventListener("scroll", checkScroll)
            window.removeEventListener("resize", checkScroll)
            if (observerRef.current) {
                observerRef.current.disconnect()
            }
            clearInterval(interval)
        }
    }, [])

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    if (!showTop) return null

    const colorClasses = {
        primary: "bg-[#8B2323] shadow-[#8B2323]/20 hover:shadow-[#8B2323]/40",
        red: "bg-red-600 shadow-red-600/20 hover:shadow-red-600/40",
        maroon: "bg-[#8B2323] shadow-[#8B2323]/20 hover:shadow-[#8B2323]/40"
    }

    return (
        <div className={cn(
            "fixed right-6 z-[100] flex flex-col gap-3 group transition-all duration-300",
            offset || "bottom-6"
        )}>
            {showTop && (
                <Button
                    variant="default"
                    size="icon"
                    className={cn(
                        "h-12 w-12 rounded-full shadow-xl text-white transition-all duration-300 transform hover:scale-110 active:scale-95 border-2 border-white/20",
                        colorClasses[variant]
                    )}
                    onClick={scrollToTop}
                    title="Scroll to top"
                >
                    <UpIcon className="h-6 w-6" />
                </Button>
            )}
        </div>
    )
}
