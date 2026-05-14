import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCache, setCache, CacheKeys, TTL } from '@/lib/cache'

export async function GET() {
    try {
        const cached = await getCache<object[]>(CacheKeys.managers)
        if (cached) return NextResponse.json(cached)

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

        await setCache(CacheKeys.managers, managers, TTL.managers)
        return NextResponse.json(managers)
    } catch (error) {
        console.error("Fetch managers error:", error)
        return NextResponse.json({ error: 'Failed to fetch managers' }, { status: 500 })
    }
}
