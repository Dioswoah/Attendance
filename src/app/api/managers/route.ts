import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        // Fetch users who have MANAGER or ADMIN role
        const managers = await prisma.user.findMany({
            where: {
                deletedAt: null,
                OR: [
                    { roles: { has: 'MANAGER' } },
                    { roles: { has: 'ADMIN' } }
                ]
            },
            select: {
                id: true,
                name: true
            },
            orderBy: {
                name: 'asc'
            }
        })

        return NextResponse.json(managers)
    } catch (error) {
        console.error("Fetch managers error:", error)
        return NextResponse.json({ error: 'Failed to fetch managers' }, { status: 500 })
    }
}
