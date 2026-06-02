import { prisma } from '@/lib/prisma'
import { xeroFetch, getXeroToken } from '@/lib/xero'

export async function syncXeroLeaveBalances(): Promise<{ synced: number; skipped: number; error?: string }> {
    // Verify Xero is connected before doing anything
    try {
        await getXeroToken()
    } catch {
        return { synced: 0, skipped: 0, error: 'Xero not connected' }
    }

    // Fetch all Australia-based staff from our DB
    const australiaUsers = await prisma.user.findMany({
        where: { employmentLocation: 'Australia', isArchived: false, email: { not: '' } },
        select: { id: true, email: true },
    })

    if (!australiaUsers.length) return { synced: 0, skipped: 0 }

    // Fetch all Xero employees in one call
    const data = await xeroFetch('/payroll.xro/1.0/Employees')
    const xeroEmployees: any[] = data.Employees || []

    let synced = 0
    let skipped = 0

    for (const user of australiaUsers) {
        const email = user.email.toLowerCase().trim()
        const xeroMatch = xeroEmployees.find((e: any) => (e.Email || '').toLowerCase() === email)

        if (!xeroMatch) { skipped++; continue }

        // Fetch full employee detail for leave balances
        const detail = await xeroFetch(`/payroll.xro/1.0/Employees/${xeroMatch.EmployeeID}`)
        const emp = detail.Employees?.[0] || xeroMatch
        const leaveBalances: { name: string; units: number }[] = (emp.LeaveBalances || []).map((lb: any) => ({
            name: lb.LeaveName,
            units: lb.NumberOfUnits,
        }))

        if (!leaveBalances.length) { skipped++; continue }

        // Upsert each leave type balance
        await Promise.all(
            leaveBalances.map(lb =>
                prisma.xeroLeaveBalance.upsert({
                    where: { userId_leaveName: { userId: user.id, leaveName: lb.name } },
                    create: { userId: user.id, xeroId: xeroMatch.EmployeeID, leaveName: lb.name, hours: lb.units },
                    update: { xeroId: xeroMatch.EmployeeID, hours: lb.units },
                })
            )
        )

        synced++
    }

    return { synced, skipped }
}
