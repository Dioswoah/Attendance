import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { xeroFetch } from '@/lib/xero'

export const dynamic = 'force-dynamic'

export async function GET() {
    const session = await auth()
    if (!session?.user?.roles?.includes('ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const data = await xeroFetch('/payroll.xro/1.0/Employees')
        const employees = (data.Employees || []).map((emp: any) => ({
            xeroId: emp.EmployeeID,
            firstName: emp.FirstName,
            lastName: emp.LastName,
            email: emp.Email || null,
            status: emp.Status,
            leaveBalances: (emp.LeaveBalances || []).map((lb: any) => ({
                name: lb.LeaveName,
                units: lb.NumberOfUnits,
                typeOfUnits: lb.TypeOfUnits,
            })),
        }))
        return NextResponse.json({ employees, total: employees.length })
    } catch (err: any) {
        console.error('[Xero employees]', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
