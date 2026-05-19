// Update PATCH_VERSION + add entries to PATCH_NOTES every time a build is promoted from staging → prod.
// The modal will auto-show once per version. "Got it" acknowledges; X closes without saving (shows again next visit).

export const PATCH_VERSION = "1.3.1"

export const PATCH_NOTES: {
    version: string
    date: string
    changes: { type: 'feature' | 'fix' | 'improvement'; text: string }[]
} = {
    version: PATCH_VERSION,
    date: "2026-05-20",
    changes: [
        { type: 'fix', text: "Auto clock-out dashboard refresh now instant — no more staying 'Clocked In' for up to a minute after the system clocks you out" },
        { type: 'fix', text: "Activity log now shows correct labels for all events — Leave Approved, Correction Approved/Declined, Leave Cancelled, and others no longer display as raw system text" },
        { type: 'improvement', text: "Leaves & Absences filter in Activity Logs now includes correction requests (approved, declined, deleted)" },
        { type: 'feature', text: "KPI Dashboard — attendance, leave, department performance, tardiness, and peak clock-in analytics" },
        { type: 'feature', text: "Staff Assessment in KPI — select one or more staff to review individual attendance patterns with daily calendar view" },
        { type: 'feature', text: "Leave history panel in Grant Leave tab shows the selected staff member's full leave history" },
        { type: 'feature', text: "Daily Event Log: Status and Access column filters added" },
        { type: 'feature', text: "Manager Activity: 5-year date range, per-manager/staff/type filters, and pagination on the review log" },
        { type: 'feature', text: "Manual Entry: Staff Info Panel with duplicate record detection" },
        { type: 'feature', text: "Profile Settings: primary department, secondary departments, and employment location are now editable" },
        { type: 'improvement', text: "Dashboard department filter now persists across page navigation" },
        { type: 'improvement', text: "Dept View / All Staff toggle on the dashboard — grouped by department or flat list" },
        { type: 'fix', text: "Auto clock-out now stamps at your individual shift end time instead of a fixed 9 PM" },
        { type: 'fix', text: "Dashboard no longer loses staff data when a real-time update arrives before the initial load completes" },
    ]
}
