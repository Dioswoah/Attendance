import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PUT(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    if (!params.id) {
        return NextResponse.json({ error: 'Attendance id missing' }, { status: 400 });
    }
    try {
        const body = await request.json()
        const { clockOut, status, notes } = body

        const attendance = await prisma.attendance.update({
            where: { id: params.id },
            data: {
                ...(clockOut && { clockOut: new Date(clockOut) }),
                ...(status && { status }),
                ...(notes && { notes })
            }
        })

        return NextResponse.json(attendance)
    } catch (error) {
        console.error('Error updating attendance:', error)
        return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 })
    }
}
