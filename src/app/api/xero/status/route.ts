import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getXeroToken } from '@/lib/xero'

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

    if (connected) {
        return NextResponse.json({ connected, tenantName, tokenExpiresAt: expiry ? new Date(expiry).toISOString() : null })
    }

    // No stored OAuth session — report a Custom Connection (client_credentials) if env creds work
    try {
        await getXeroToken()
        return NextResponse.json({ connected: true, mode: 'custom_connection', tenantName: tenantName || 'Custom Connection', tokenExpiresAt: null })
    } catch {
        return NextResponse.json({ connected: false, tenantName: '', tokenExpiresAt: null })
    }
}
