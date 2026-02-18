
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Check if user is admin
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { roles: true }
        })

        if (!user?.roles.includes('ADMIN')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const settings = await prisma.systemSettings.findMany()
        const settingsMap = settings.reduce((acc: any, curr) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        return NextResponse.json(settingsMap)
    } catch (error) {
        console.error("Failed to fetch settings:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { roles: true }
        })

        if (!user?.roles.includes('ADMIN')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const { key, value } = body

        if (!key || value === undefined) {
            return NextResponse.json({ error: "Missing key or value" }, { status: 400 })
        }

        const updated = await prisma.systemSettings.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) }
        })

        return NextResponse.json(updated)

    } catch (error) {
        console.error("Failed to update settings:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
