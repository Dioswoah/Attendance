"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronUp as UpIcon, ChevronDown as DownIcon } from "lucide-react"

interface ScrollIndicatorProps {
    offset?: string; // Tailwind class for bottom offset, e.g. "bottom-24"
    variant?: "primary" | "red" | "maroon";
}

export function ScrollIndicator({ offset, variant = "primary" }: ScrollIndicatorProps) {
    const [showTop, setShowTop] = useState(false)
    const [showBottom, setShowBottom] = useState(false)
    const observerRef = useRef<ResizeObserver | null>(null)

    const checkScroll = () => {
        // We check both the body and the documentElement to be safe
        const scrolled = window.scrollY || document.documentElement.scrollTop
        const viewportHeight = window.innerHeight
        const fullHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight
        )

        // Show "Scroll to Top" if we've scrolled more than 200px (lowered from 300)
        setShowTop(scrolled > 200)

        // Show "Scroll to Bottom" if there's significant content left to scroll
        // Lowered threshold to 50px for better precision
        const isNearBottom = scrolled + viewportHeight >= fullHeight - 50
        setShowBottom(!isNearBottom && fullHeight > viewportHeight + 20)
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

    const scrollToBottom = () => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })
    }

    if (!showTop && !showBottom) return null

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
            {/* Scroll Down Hint */}
            {showBottom && (
                <Button
                    variant="default"
                    size="icon"
                    className={cn(
                        "h-10 w-10 rounded-full shadow-lg transition-all duration-300 animate-bounce hover:animate-none border-2 border-white/20",
                        colorClasses[variant],
                        showTop ? "opacity-50 hover:opacity-100" : "opacity-100"
                    )}
                    onClick={scrollToBottom}
                    title="Scroll to bottom"
                >
                    <DownIcon className="h-5 w-5 text-white" />
                </Button>
            )}

            {/* Scroll to Top Button */}
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
