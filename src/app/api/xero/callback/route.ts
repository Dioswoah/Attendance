import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/admin/settings?xero=error&reason=${error || 'no_code'}`)
    }

    const clientId = process.env.XERO_CLIENT_ID!
    const clientSecret = process.env.XERO_CLIENT_SECRET!
    const redirectUri = process.env.XERO_REDIRECT_URI!

    // Exchange code for tokens
    const tokenRes = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        }),
    })

    if (!tokenRes.ok) {
        const body = await tokenRes.text()
        console.error('[Xero callback] Token exchange failed:', body)
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/admin/settings?xero=error&reason=token_exchange`)
    }

    const tokens = await tokenRes.json()

    // Get the connected tenant (org)
    const connectionsRes = await fetch('https://api.xero.com/connections', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    })
    const connections = await connectionsRes.json()
    const tenant = connections[0]

    if (!tenant?.tenantId) {
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/admin/settings?xero=error&reason=no_tenant`)
    }

    const expiry = Date.now() + tokens.expires_in * 1000

    await Promise.all([
        prisma.systemSettings.upsert({ where: { key: 'xero_access_token' }, create: { key: 'xero_access_token', value: tokens.access_token }, update: { value: tokens.access_token } }),
        prisma.systemSettings.upsert({ where: { key: 'xero_refresh_token' }, create: { key: 'xero_refresh_token', value: tokens.refresh_token }, update: { value: tokens.refresh_token } }),
        prisma.systemSettings.upsert({ where: { key: 'xero_tenant_id' }, create: { key: 'xero_tenant_id', value: tenant.tenantId }, update: { value: tenant.tenantId } }),
        prisma.systemSettings.upsert({ where: { key: 'xero_tenant_name' }, create: { key: 'xero_tenant_name', value: tenant.tenantName || '' }, update: { value: tenant.tenantName || '' } }),
        prisma.systemSettings.upsert({ where: { key: 'xero_token_expiry' }, create: { key: 'xero_token_expiry', value: String(expiry) }, update: { value: String(expiry) } }),
    ])

    console.log(`[Xero] Connected to tenant: ${tenant.tenantName} (${tenant.tenantId})`)

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/admin/settings?xero=connected`)
}
