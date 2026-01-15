import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const employees = await prisma.user.findMany({
            where: { role: 'USER' },
            include: {
                department: true
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
                email: body.email,
                departmentId: body.departmentId,
                role: 'USER'
            }
        })
        return NextResponse.json(employee)
    } catch (error) {
        console.error("Create employee error:", error)
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
    }
}
