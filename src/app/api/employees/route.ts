import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const employees = await prisma.user.findMany({
            where: {
                deletedAt: null,
                isArchived: false
            },
            include: {
                department: true,
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
        return NextResponse.json(employees)
    } catch (error) {
        console.error("Fetch employees error:", error)
        return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const employee = await prisma.user.create({
            data: {
                name: body.name,
                email: body.email.toLowerCase(),
                departmentId: body.departmentId,
                roles: body.roles || ['USER'],
                managerId: body.managerId || null,
                location: body.location || null,
                // SYNC: Set default timezone based on chosen location
                selectedTimezone: body.location === 'Philippines' ? 'Asia/Manila' :
                    body.location === 'Australia' ? 'Australia/Sydney' : 'UTC',
                useCurrentTimezone: false
            }
        })
        return NextResponse.json(employee)
    } catch (error) {
        console.error("Create employee error:", error)
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
    }
}
