import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user?.roles?.includes('ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.XERO_CLIENT_ID
    const redirectUri = process.env.XERO_REDIRECT_URI

    if (!clientId || !redirectUri) {
        return NextResponse.json({ error: 'Xero credentials not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')

    // mode=test uses only basic scopes to verify OAuth works without payroll access
    const scopes = mode === 'test'
        ? ['openid', 'profile', 'email', 'offline_access', 'accounting.settings.read']
        : ['openid', 'profile', 'email', 'offline_access', 'payroll.employees.read', 'payroll.payruns.read']

    const authUrl = new URL('https://login.xero.com/identity/connect/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes.join(' '))
    authUrl.searchParams.set('state', 'xero-connect')

    return NextResponse.redirect(authUrl.toString())
}
