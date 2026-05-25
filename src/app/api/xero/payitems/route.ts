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
        const data = await xeroFetch('/payroll.xro/1.0/PayItems')
        const leaveTypes = (data.PayItems?.[0]?.LeaveTypes || []).map((lt: any) => ({
            leaveTypeId: lt.LeaveTypeID,
            name: lt.Name,
            isPaidLeave: lt.IsPaidLeave,
            showOnPayslip: lt.ShowOnPayslip,
            typeOfUnits: lt.TypeOfUnits,
        }))
        return NextResponse.json({ leaveTypes, total: leaveTypes.length })
    } catch (err: any) {
        console.error('[Xero payitems]', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
