import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const employees = await prisma.user.findMany({
            where: {
                deletedAt: null
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
        const { name, email, departmentId, roles, managerId, location, shiftStartTime } = body
        const employee = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                roles: roles || ['USER'],
                employmentLocation: location || null,
                shiftStartTime: shiftStartTime || "09:00",
                department: departmentId ? { connect: { id: departmentId } } : undefined,
                manager: managerId ? { connect: { id: managerId } } : undefined,
                // SYNC: Set default timezone based on chosen location
                selectedTimezone: location === 'Philippines' ? 'Asia/Manila' :
                    location === 'Australia' ? 'Australia/Sydney' : 'UTC',
                useCurrentTimezone: false
            }
        })
        return NextResponse.json(employee)
    } catch (error) {
        console.error("Create employee error:", error)
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
    }
}
