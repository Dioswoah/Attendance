"use client"

import { useState } from "react"
import { PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function ValidationPopoverContent({ record, staffNote, onValidate, onFlag, onClear }: {
    record: any
    staffNote: string
    onValidate: () => Promise<void>
    onFlag: (note: string) => Promise<void>
    onClear: () => Promise<void>
}) {
    const [mode, setMode] = useState<'idle' | 'flagging'>('idle')
    const [note, setNote] = useState(staffNote)
    const [saving, setSaving] = useState(false)
    const status = record?.validationStatus

    const runAction = async (action: () => Promise<void>) => {
        setSaving(true)
        try {
            await action()
            setMode('idle')
        } finally {
            setSaving(false)
        }
    }

    return (
        <PopoverContent className="w-72 p-3" align="center">
            {mode === 'idle' ? (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Review this record</p>
                    {status === 'VALIDATED' && (
                        <p className="text-xs text-teal-600 font-medium">Marked as validated.</p>
                    )}
                    {status === 'NEEDS_CORRECTION' && staffNote && (
                        <p className="text-xs text-fuchsia-600 font-medium">Flagged: {staffNote}</p>
                    )}
                    <div className="flex flex-col gap-1.5 pt-1">
                        <Button size="sm" disabled={saving} className="h-8 text-xs bg-teal-600 hover:bg-teal-700" onClick={() => runAction(onValidate)}>
                            Validate
                        </Button>
                        <Button size="sm" disabled={saving} variant="outline" className="h-8 text-xs border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-50" onClick={() => setMode('flagging')}>
                            Needs Correction
                        </Button>
                        {status && (
                            <Button size="sm" disabled={saving} variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => runAction(onClear)}>
                                Clear Status
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">What needs to be corrected?</p>
                    <Textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Describe the issue for this staff member..."
                        className="text-xs min-h-[80px]"
                    />
                    <div className="flex gap-2">
                        <Button size="sm" disabled={saving} className="h-8 text-xs bg-fuchsia-600 hover:bg-fuchsia-700 flex-1" onClick={() => runAction(() => onFlag(note))}>
                            Save
                        </Button>
                        <Button size="sm" disabled={saving} variant="ghost" className="h-8 text-xs" onClick={() => setMode('idle')}>
                            Back
                        </Button>
                    </div>
                </div>
            )}
        </PopoverContent>
    )
}
