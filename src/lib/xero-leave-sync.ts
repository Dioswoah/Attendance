import { prisma } from '@/lib/prisma'
import { xeroFetch, getXeroToken } from '@/lib/xero'

export async function syncXeroLeaveBalances(triggeredBy: string = 'cron'): Promise<{ synced: number; skipped: number; error?: string }> {
    // Verify Xero is connected before doing anything
    try {
        await getXeroToken()
    } catch {
        return { synced: 0, skipped: 0, error: 'Xero not connected' }
    }

    // Fetch all Australia-based staff from our DB
    const australiaUsers = await prisma.user.findMany({
        where: { employmentLocation: 'Australia', isArchived: false, email: { not: '' } },
        select: { id: true, email: true, xeroEmployeeId: true },
    })

    if (!australiaUsers.length) return { synced: 0, skipped: 0 }

    // Fetch all Xero employees in one call
    const data = await xeroFetch('/payroll.xro/1.0/Employees')
    const xeroEmployees: any[] = data.Employees || []

    let synced = 0
    let skipped = 0

    for (const user of australiaUsers) {
        // Explicit mapping first (Xero mostly stores personal emails, so email
        // match only works for the few staff whose work email is in Xero)
        const email = user.email.toLowerCase().trim()
        const xeroMatch = user.xeroEmployeeId
            ? xeroEmployees.find((e: any) => e.EmployeeID === user.xeroEmployeeId)
            : xeroEmployees.find((e: any) => (e.Email || '').toLowerCase() === email)

        if (!xeroMatch) { skipped++; continue }

        // Fetch full employee detail for leave balances
        const detail = await xeroFetch(`/payroll.xro/1.0/Employees/${xeroMatch.EmployeeID}`)
        const emp = detail.Employees?.[0] || xeroMatch
        const leaveBalances: { name: string; units: number }[] = (emp.LeaveBalances || []).map((lb: any) => ({
            name: lb.LeaveName,
            units: lb.NumberOfUnits,
        }))

        if (!leaveBalances.length) { skipped++; continue }

        // Upsert the current-state row, and separately append a history row —
        // the log is never overwritten so past balances stay visible.
        await Promise.all(
            leaveBalances.map(lb =>
                prisma.xeroLeaveBalance.upsert({
                    where: { userId_leaveName: { userId: user.id, leaveName: lb.name } },
                    create: { userId: user.id, xeroId: xeroMatch.EmployeeID, leaveName: lb.name, hours: lb.units },
                    update: { xeroId: xeroMatch.EmployeeID, hours: lb.units },
                })
            )
        )
        await prisma.xeroLeaveSyncLog.createMany({
            data: leaveBalances.map(lb => ({
                userId: user.id,
                xeroId: xeroMatch.EmployeeID,
                leaveName: lb.name,
                hours: lb.units,
                triggeredBy,
            })),
        })

        synced++
    }

    return { synced, skipped }
}
