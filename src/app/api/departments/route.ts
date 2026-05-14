import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCache, setCache, invalidateCache, CacheKeys, TTL } from '@/lib/cache'

export async function GET() {
    try {
        const cached = await getCache<object[]>(CacheKeys.departments)
        if (cached) return NextResponse.json(cached)

        const departments = await prisma.department.findMany({
            where: { deletedAt: null },
            orderBy: { name: 'asc' }
        })

        await setCache(CacheKeys.departments, departments, TTL.departments)
        return NextResponse.json(departments)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const department = await prisma.department.create({
            data: { name: body.name }
        })

        await invalidateCache(CacheKeys.departments)
        return NextResponse.json(department)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
    }
}
