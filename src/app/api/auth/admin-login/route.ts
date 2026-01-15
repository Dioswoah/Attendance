import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { password } = body

        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "RedadairAdmin2024"

        if (password === ADMIN_PASSWORD) {
            return NextResponse.json({ success: true })
        } else {
            return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 })
        }
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
