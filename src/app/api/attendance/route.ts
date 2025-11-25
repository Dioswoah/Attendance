import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const date = searchParams.get('date')
        const userId = searchParams.get('userId')

        const where: any = {}

        if (date) {
            const searchDate = new Date(date)
            const nextDate = new Date(searchDate)
            nextDate.setDate(nextDate.getDate() + 1)

            where.date = {
                gte: searchDate,
                lt: nextDate
            }
        }

        if (userId) {
            where.userId = userId
        }

        const attendance = await prisma.attendance.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                clockIn: 'desc'
            }
        })

        return NextResponse.json(attendance)
    } catch (error) {
        console.error('Error fetching attendance:', error)
        return NextResponse.json({ error: 'Failed to fetch attendance', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId, clockIn, clockOut, mode, status, breakStart, breakEnd } = body

        const attendance = await prisma.attendance.create({
            data: {
                userId,
                date: new Date(clockIn),
                clockIn: new Date(clockIn),
                clockOut: clockOut ? new Date(clockOut) : null,
                mode,
                status,
                breakStart: breakStart ? new Date(breakStart) : null,
                breakEnd: breakEnd ? new Date(breakEnd) : null
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        })

        return NextResponse.json(attendance)
    } catch (error) {
        console.error('Error creating attendance:', error)
        return NextResponse.json({ error: 'Failed to create attendance', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
    }
}

