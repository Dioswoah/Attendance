import { prisma } from '@/lib/prisma'

const TOKEN_URL = 'https://identity.xero.com/connect/token'

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiry: number }> {
    const clientId = process.env.XERO_CLIENT_ID!
    const clientSecret = process.env.XERO_CLIENT_SECRET!
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    })
    if (!res.ok) throw new Error(`Xero token refresh failed: ${res.status}`)
    const data = await res.json()
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiry: Date.now() + data.expires_in * 1000,
    }
}

// Custom Connection (client_credentials) support: tokens are minted on demand from
// XERO_CLIENT_ID/XERO_CLIENT_SECRET and are bound to a single organisation, so there is
// no user login, no redirect URI and no refresh token. Cached in memory (30-min expiry).
let ccCache: { accessToken: string; tenantId: string; expiry: number } | null = null

async function getClientCredentialsToken(): Promise<{ accessToken: string; tenantId: string }> {
    if (ccCache && Date.now() < ccCache.expiry - 60_000) {
        return { accessToken: ccCache.accessToken, tenantId: ccCache.tenantId }
    }
    const clientId = process.env.XERO_CLIENT_ID
    const clientSecret = process.env.XERO_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error('Xero not connected')

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }),
    })
    if (!res.ok) throw new Error(`Xero client_credentials token failed: ${res.status}`)
    const data = await res.json()

    const connRes = await fetch('https://api.xero.com/connections', {
        headers: { 'Authorization': `Bearer ${data.access_token}`, 'Accept': 'application/json' },
    })
    const tenants = connRes.ok ? await connRes.json() : []
    const tenantId = Array.isArray(tenants) && tenants[0]?.tenantId ? tenants[0].tenantId : ''
    if (!tenantId) throw new Error('Xero custom connection has no authorised organisation')

    ccCache = { accessToken: data.access_token, tenantId, expiry: Date.now() + data.expires_in * 1000 }
    return { accessToken: ccCache.accessToken, tenantId }
}

export async function getXeroToken(): Promise<{ accessToken: string; tenantId: string }> {
    const rows = await prisma.systemSettings.findMany({
        where: { key: { in: ['xero_access_token', 'xero_refresh_token', 'xero_tenant_id', 'xero_token_expiry'] } },
    })
    const get = (key: string) => rows.find(r => r.key === key)?.value ?? ''

    let accessToken = get('xero_access_token')
    const refreshToken = get('xero_refresh_token')
    const tenantId = get('xero_tenant_id')
    const expiry = Number(get('xero_token_expiry') || 0)

    // No interactive OAuth connection stored -> use the Custom Connection flow
    if (!accessToken || !tenantId || !refreshToken) return getClientCredentialsToken()

    if (Date.now() > expiry - 60_000 && refreshToken) {
        const fresh = await refreshAccessToken(refreshToken)
        accessToken = fresh.accessToken
        await Promise.all([
            prisma.systemSettings.upsert({ where: { key: 'xero_access_token' }, create: { key: 'xero_access_token', value: fresh.accessToken }, update: { value: fresh.accessToken } }),
            prisma.systemSettings.upsert({ where: { key: 'xero_refresh_token' }, create: { key: 'xero_refresh_token', value: fresh.refreshToken }, update: { value: fresh.refreshToken } }),
            prisma.systemSettings.upsert({ where: { key: 'xero_token_expiry' }, create: { key: 'xero_token_expiry', value: String(fresh.expiry) }, update: { value: String(fresh.expiry) } }),
        ])
    }

    return { accessToken, tenantId }
}

export async function xeroFetch(path: string): Promise<any> {
    const { accessToken, tenantId } = await getXeroToken()
    const res = await fetch(`https://api.xero.com${path}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Xero-Tenant-Id': tenantId,
            'Accept': 'application/json',
        },
    })
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Xero API error ${res.status}: ${body}`)
    }
    return res.json()
}
