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
        const data = await xeroFetch('/api.xro/2.0/Organisation')
        const org = data.Organisations?.[0]
        return NextResponse.json({
            name: org?.Name,
            legalName: org?.LegalName,
            country: org?.CountryCode,
            currency: org?.BaseCurrency,
            timezone: org?.Timezone,
            organisationType: org?.OrganisationType,
            isDemoCompany: org?.IsDemoCompany,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
