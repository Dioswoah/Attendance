"use client"

import { useEffect, useState } from "react"
import { PATCH_NOTES, PATCH_VERSION } from "@/lib/patch-notes"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Wrench, Zap, X } from "lucide-react"
import { cn } from "@/lib/utils"

const LS_KEY = "lastAcknowledgedPatch"

const typeConfig = {
    feature: { icon: Sparkles, label: "New", className: "bg-primary/10 text-primary border-primary/20" },
    improvement: { icon: Zap, label: "Improved", className: "bg-blue-50 text-blue-600 border-blue-200" },
    fix: { icon: Wrench, label: "Fixed", className: "bg-green-50 text-green-600 border-green-200" },
}

export function PatchNotesModal({ isAdmin }: { isAdmin?: boolean }) {
    const [open, setOpen] = useState(false)
    const blocking = PATCH_NOTES.blocking ?? false

    useEffect(() => {
        try {
            const acknowledged = localStorage.getItem(LS_KEY)
            if (acknowledged !== PATCH_VERSION) {
                setOpen(true)
            }
        } catch {
            // localStorage unavailable — skip
        }
    }, [])

    const acknowledge = () => {
        try {
            localStorage.setItem(LS_KEY, PATCH_VERSION)
        } catch { }
        setOpen(false)
    }

    // X close — does NOT save, will show again next visit
    const dismiss = () => setOpen(false)

    if (!open) return null

    const visibleChanges = PATCH_NOTES.changes.filter(
        c => !c.audience || c.audience === 'all' || (c.audience === 'admin' && isAdmin)
    )

    return (
        <Dialog open={open} onOpenChange={blocking ? () => {} : val => { if (!val) dismiss() }}>
            <DialogContent
                className="sm:max-w-lg p-0 overflow-hidden gap-0"
                showCloseButton={false}
                onInteractOutside={e => e.preventDefault()}
                onEscapeKeyDown={blocking ? e => e.preventDefault() : undefined}
            >
                {/* Custom close button — hidden when blocking */}
                {!blocking && (
                    <button
                        onClick={dismiss}
                        className="absolute right-4 top-4 z-10 rounded-full h-7 w-7 flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                )}

                {/* Header */}
                <div className="bg-gradient-to-br from-primary/5 via-primary/[0.03] to-transparent border-b border-border px-6 pt-6 pb-5">
                    <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-foreground leading-tight">
                                {blocking ? "Important Notice" : "What's New"}
                            </DialogTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                    v{PATCH_NOTES.version}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground">{PATCH_NOTES.date}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Change list */}
                {blocking ? (
                    <div className="px-6 py-5 space-y-3">
                        {visibleChanges.map((change, i) => (
                            <p key={i} className="text-sm text-foreground leading-snug">{change.text}</p>
                        ))}
                    </div>
                ) : (
                    <div className="px-6 py-4 max-h-80 overflow-y-auto space-y-2">
                        {visibleChanges.map((change, i) => {
                            const config = typeConfig[change.type]
                            const Icon = config.icon
                            return (
                                <div key={i} className="flex items-start gap-3 py-1.5">
                                    <div className={cn("mt-0.5 flex items-center gap-1 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest", config.className)}>
                                        <Icon className="h-2.5 w-2.5" />
                                        {config.label}
                                    </div>
                                    <p className="text-sm text-foreground leading-snug">{change.text}</p>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Footer */}
                {blocking ? (
                    <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-center">
                        <Button
                            onClick={() => { window.location.href = "https://staff.redadair.com.au" }}
                            size="sm"
                            className="h-9 px-5 bg-primary hover:bg-primary/90 text-white text-xs font-bold"
                        >
                            Go to staff.redadair.com.au
                        </Button>
                    </div>
                ) : (
                    <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
                        <p className="text-[11px] text-muted-foreground leading-snug">
                            Click <span className="font-semibold text-foreground">Got it</span> to dismiss permanently for this version.
                        </p>
                        <Button onClick={acknowledge} size="sm" className="h-9 px-5 bg-primary hover:bg-primary/90 text-white text-xs font-bold shrink-0">
                            Got it, thanks!
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
