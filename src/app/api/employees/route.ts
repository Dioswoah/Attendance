import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
    try {
        const employees = await prisma.user.findMany({
            include: {
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                team: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        })

        return NextResponse.json(employees)
    } catch (error) {
        console.error('Error fetching employees:', error)
        return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, email, role, departmentId, teamId } = body

        const employee = await prisma.user.create({
            data: {
                name,
                email,
                role,
                departmentId,
                teamId
            },
            include: {
                department: true,
                team: true
            }
        })

        return NextResponse.json(employee)
    } catch (error) {
        console.error('Error creating employee:', error)
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
    }
}
