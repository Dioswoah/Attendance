// Update PATCH_VERSION + add entries to PATCH_NOTES every time a build is promoted from staging → prod.
// The modal will auto-show once per version. "Got it" acknowledges; X closes without saving (shows again next visit).
// audience: 'admin' entries only show to managers and admins — never to regular staff.

export const PATCH_VERSION = "1.3.2"

export const PATCH_NOTES: {
    version: string
    date: string
    changes: { type: 'feature' | 'fix' | 'improvement'; text: string; audience?: 'all' | 'admin' }[]
} = {
    version: PATCH_VERSION,
    date: "2026-05-20",
    changes: [
        { type: 'fix', text: "Your dashboard now updates instantly when the system clocks you out — no more showing 'Clocked In' for up to a minute after auto clock-out" },
        { type: 'fix', text: "Activity log now shows readable labels for all events — Leave Approved, Correction Approved/Declined, Leave Cancelled, and others are no longer raw system text" },
        { type: 'improvement', text: "The 'Leaves & Absences' filter in your activity log now also shows correction requests you submitted, had approved, or declined" },
        { type: 'fix', text: "Auto clock-out now uses your own shift end time, not a fixed system time" },
        { type: 'fix', text: "Dashboard no longer shows incomplete or missing staff when a live update arrives at the same moment as your initial page load" },
        { type: 'improvement', text: "Your dashboard department filter is now remembered when you navigate away and come back" },
        { type: 'feature', text: "Dashboard now lets you toggle between a grouped department view and a flat staff list" },
        { type: 'feature', text: "Profile Settings now shows your primary department, secondary departments, and work location — and you can update them yourself", audience: 'all' },
        { type: 'feature', text: "KPI Dashboard — view team attendance rates, leave usage, tardiness, and peak clock-in times across all departments", audience: 'admin' },
        { type: 'feature', text: "Staff Assessment — select one or more staff members to review individual attendance patterns with a daily calendar view", audience: 'admin' },
        { type: 'feature', text: "Grant Leave now shows the selected staff member's full leave history in a side panel", audience: 'admin' },
        { type: 'feature', text: "Daily Event Log now has Status and Access type column filters", audience: 'admin' },
        { type: 'feature', text: "Manager Activity now supports a 5-year date range with filters for manager, staff member, and request type — plus pagination on large result sets", audience: 'admin' },
        { type: 'feature', text: "Manual Entry now shows a staff info panel with duplicate record detection before saving", audience: 'admin' },
    ]
}
