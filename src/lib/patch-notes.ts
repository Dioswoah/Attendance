// Update PATCH_VERSION + add entries to PATCH_NOTES every time a build is promoted from staging → prod.
// The modal will auto-show once per version. "Got it" acknowledges; X closes without saving (shows again next visit).
// audience: 'admin' entries only show to managers and admins — never to regular staff.
// blocking: true — removes all dismiss controls; only a redirect button is shown.

export const PATCH_VERSION = "1.4.0"

export const PATCH_NOTES: {
    version: string
    date: string
    blocking?: boolean
    changes: { type: 'feature' | 'fix' | 'improvement'; text: string; audience?: 'all' | 'admin' }[]
} = {
    version: PATCH_VERSION,
    date: "2026-06-01",
    changes: [
        { type: 'feature', text: "Biometric Records — Philippines staff can now view and compare their biometric clock-in times against their app records", audience: 'all' },
        { type: 'improvement', text: "Export Ledger — Department filter now supports selecting multiple departments at once, narrowing the staff list automatically", audience: 'admin' },
        { type: 'improvement', text: "Leave Records export — Department filter also upgraded to multi-select", audience: 'admin' },
        { type: 'improvement', text: "AI Insights — Department Performance table simplified, Peak Clock-In Hours and By Employment Location sections removed", audience: 'admin' },
    ]
}
