import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const departments = await prisma.department.findMany({
            include: {
                _count: {
                    select: {
                        users: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        })

        return NextResponse.json(departments)
    } catch (error) {
        console.error('Error fetching departments:', error)
        return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name } = body

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Department name is required' }, { status: 400 })
        }

        const department = await prisma.department.create({
            data: {
                name: name.trim()
            }
        })

        return NextResponse.json(department)
    } catch (error: any) {
        console.error('Error creating department:', error)

        // Handle unique constraint violation
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Department name already exists' }, { status: 409 })
        }

        return NextResponse.json({
            error: 'Failed to create department',
            details: error.message
        }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, name } = body

        const department = await prisma.department.update({
            where: { id },
            data: {
                name
            }
        })

        return NextResponse.json(department)
    } catch (error) {
        console.error('Error updating department:', error)
        return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Department ID required' }, { status: 400 })
        }

        await prisma.department.delete({
            where: { id }
        })

        return NextResponse.json({ message: 'Department deleted successfully' })
    } catch (error) {
        console.error('Error deleting department:', error)
        return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
    }
}
