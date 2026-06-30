import { NextResponse } from 'next/server'
import { auth } from '@/auth'

// Server-side reverse geocoding via Nominatim (OpenStreetMap)
// Proxied server-side so the browser never hits Nominatim directly (avoids CORS + rate-limit issues)
export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    if (!lat || !lng) return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`
        const res = await fetch(url, {
            headers: { 'User-Agent': 'RedadairAttendanceApp/1.0 (marcr@redadair.com.au)' },
            next: { revalidate: 86400 } // cache response for 24h at the edge — same coords return same address
        })

        if (!res.ok) return NextResponse.json({ address: null }, { status: 200 })

        const data = await res.json()
        const address = data.display_name || null
        return NextResponse.json({ address })
    } catch {
        return NextResponse.json({ address: null }, { status: 200 })
    }
}
