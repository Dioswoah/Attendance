import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
    try {
        const departments = await prisma.department.findMany({
            where: { deletedAt: null },
            orderBy: { name: 'asc' }
        })
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
        return NextResponse.json(department)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
    }
}
