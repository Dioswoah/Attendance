import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
    const session = await auth()
    if (!session?.user?.roles?.includes('ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await prisma.systemSettings.findMany({
        where: { key: { in: ['xero_tenant_name', 'xero_token_expiry', 'xero_access_token'] } },
    })
    const get = (key: string) => rows.find(r => r.key === key)?.value ?? ''

    const connected = !!get('xero_access_token')
    const tenantName = get('xero_tenant_name')
    const expiry = Number(get('xero_token_expiry') || 0)

    return NextResponse.json({ connected, tenantName, tokenExpiresAt: expiry ? new Date(expiry).toISOString() : null })
}
