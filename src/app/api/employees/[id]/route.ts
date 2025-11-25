import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    if (!params.id) {
        return NextResponse.json({ error: 'Employee id missing' }, { status: 400 });
    }
    try {
        const employee = await prisma.user.findUnique({
            where: { id: params.id },
            include: {
                department: true,
                team: true
            }
        })

        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
        }

        return NextResponse.json(employee)
    } catch (error) {
        console.error('Error fetching employee:', error)
        return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 })
    }
}

export async function PUT(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    if (!params.id) {
        return NextResponse.json({ error: 'Employee id missing' }, { status: 400 });
    }
    try {
        const body = await request.json()
        const { name, email, role, departmentId, teamId } = body

        const employee = await prisma.user.update({
            where: { id: params.id },
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
        console.error('Error updating employee:', error);
        return NextResponse.json({ error: 'Failed to update employee', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    if (!params.id) {
        return NextResponse.json({ error: 'Employee id missing' }, { status: 400 });
    }
    try {
        await prisma.user.delete({
            where: { id: params.id }
        })

        return NextResponse.json({ message: 'Employee deleted successfully' })
    } catch (error) {
        console.error('Error deleting employee:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({
            error: 'Failed to delete employee',
            details: errorMessage
        }, { status: 500 })
    }
}
