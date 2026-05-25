import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { xeroFetch, getXeroToken } from '@/lib/xero'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')?.toLowerCase().trim()

    if (!email) {
        return NextResponse.json({ error: 'email parameter required' }, { status: 400 })
    }

    try {
        // Check if Xero is connected
        await getXeroToken()
    } catch {
        return NextResponse.json({ connected: false })
    }

    try {
        const data = await xeroFetch('/payroll.xro/1.0/Employees')
        const employees: any[] = data.Employees || []

        const match = employees.find((emp: any) =>
            (emp.Email || '').toLowerCase() === email
        )

        if (!match) {
            return NextResponse.json({ connected: true, found: false, email })
        }

        // Fetch individual employee for full leave balance details
        const detail = await xeroFetch(`/payroll.xro/1.0/Employees/${match.EmployeeID}`)
        const emp = detail.Employees?.[0] || match

        const leaveBalances = (emp.LeaveBalances || []).map((lb: any) => ({
            name: lb.LeaveName,
            units: lb.NumberOfUnits,
            typeOfUnits: lb.TypeOfUnits || 'Hours',
        }))

        return NextResponse.json({
            connected: true,
            found: true,
            xeroId: match.EmployeeID,
            name: `${match.FirstName} ${match.LastName}`,
            leaveBalances,
        })
    } catch (err: any) {
        console.error('[Xero leave-balance]', err.message)
        return NextResponse.json({ connected: false })
    }
}
