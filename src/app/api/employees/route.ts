import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCache, setCache, invalidateCache, invalidateCachePattern, CacheKeys, TTL } from '@/lib/cache'

export async function GET() {
    try {
        const cached = await getCache<object[]>(CacheKeys.employees)
        if (cached) return NextResponse.json(cached)

        const employees = await prisma.user.findMany({
            where: {
                deletedAt: null
            },
            include: {
                department: true,
                secondaryDepartments: { select: { id: true, name: true } },
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        await setCache(CacheKeys.employees, employees, TTL.employees)
        return NextResponse.json(employees)
    } catch (error) {
        console.error("Fetch employees error:", error)
        return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { name, email, departmentId, roles, managerId, location, shiftStartTime, secondaryDepartmentIds } = body
        if (Array.isArray(roles)) {
            const validRoles = ['DEVELOPER', 'ADMIN', 'MANAGER', 'OPERATIONS', 'VIEWER', 'USER']
            const invalid = roles.filter((r: string) => !validRoles.includes(r))
            if (invalid.length) {
                return NextResponse.json({ error: `Invalid role(s): ${invalid.join(', ')}` }, { status: 400 })
            }
        }
        const employee = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                roles: roles || ['USER'],
                employmentLocation: location || null,
                shiftStartTime: shiftStartTime || "09:00",
                department: departmentId ? { connect: { id: departmentId } } : undefined,
                manager: managerId ? { connect: { id: managerId } } : undefined,
                secondaryDepartments: secondaryDepartmentIds?.length
                    ? { connect: secondaryDepartmentIds.map((id: string) => ({ id })) }
                    : undefined,
                // SYNC: Set default timezone based on chosen location
                selectedTimezone: location === 'Philippines' ? 'Asia/Manila' :
                    location === 'Australia' ? 'Australia/Sydney' : 'UTC',
                useCurrentTimezone: false
            }
        })

        // Invalidate caches that include employee/manager lists
        await invalidateCache(CacheKeys.employees, CacheKeys.managers, CacheKeys.staffDashboard)
        return NextResponse.json(employee)
    } catch (error) {
        console.error("Create employee error:", error)
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
    }
}
