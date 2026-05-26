import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { runAgent } from '@/lib/agent/engine'

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { staffData, dateRange, question } = await req.json()

    if (!staffData?.length) return NextResponse.json({ error: 'No staff data provided' }, { status: 400 })

    const lines: string[] = [
        `HR Attendance Analysis Report`,
        `Period: ${dateRange.start} to ${dateRange.end}`,
        `Staff Analysed: ${staffData.length}`,
        '',
        'STAFF PERFORMANCE DATA:',
    ]

    for (const staff of staffData) {
        lines.push(`\n--- ${staff.name} (${staff.dept}, ${staff.location}) ---`)
        lines.push(`Shift: ${staff.shiftStart}–${staff.shiftEnd}`)
        lines.push(`Working Days in Period: ${staff.expectedDays}`)
        lines.push(`Attendance Rate: ${staff.attendanceRate}% | On-Time Rate: ${staff.onTimeRate}%`)
        lines.push(`Present: ${staff.presentDays}d | Absent: ${staff.absentDays}d | Late: ${staff.lateDays}x (avg ${staff.avgTardiness}min) | WFH: ${staff.wfhDays}d`)
        lines.push(`Avg Work Hours: ${staff.avgWorkHours}h/day`)
        lines.push(`Leave: Sick ${staff.sickLeaveDays}d | Vacation ${staff.vacationDays}d | Birthday ${staff.birthdayDays}d | Maternity/Paternity ${staff.maternityDays}d | Other ${staff.otherLeaveDays}d (Total ${staff.leaveDays}d)`)

        const flags: string[] = []
        if (staff.attendanceRate < 75) flags.push('low attendance rate')
        if (staff.onTimeRate < 70) flags.push('frequent tardiness')
        if (staff.sickLeaveDays >= 5) flags.push('high sick leave usage')
        if (staff.absentDays > Math.ceil(staff.expectedDays * 0.15)) flags.push('excessive unplanned absences')
        if (staff.avgTardiness > 30) flags.push('significant average tardiness')
        if (flags.length > 0) lines.push(`Concerns: ${flags.join(', ')}`)
    }

    const prompt = question
        ? `${lines.join('\n')}\n\nQuestion from HR admin: ${question}`
        : `${lines.join('\n')}\n\nPlease provide a clear, professional HR insights report for this data. Cover:\n1. Overall attendance summary\n2. Individual performance highlights (both positive and concerning)\n3. Leave utilisation patterns\n4. Punctuality and tardiness trends\n5. Specific recommendations for HR or management action\n\nBe concise and actionable. Use plain language suitable for a management audience.`

    const result = await runAgent(session.user.id, ['ADMIN'], prompt, [])

    return NextResponse.json({ insight: result.text, error: result.error })
}
