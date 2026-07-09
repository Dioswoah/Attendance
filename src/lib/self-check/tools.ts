import { FunctionTool } from "@google/adk"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

function dayRange(dateStr: string) {
    const start = new Date(dateStr)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { start, end }
}

const dateParam = z.object({
    date: z.string().describe("ISO date to inspect, e.g. 2026-07-09"),
})

export const getAttendanceSummaries = new FunctionTool({
    name: "get_attendance_summaries",
    description: "Fetch day-level attendance summaries (and their raw attendance records) for a given date.",
    parameters: dateParam,
    execute: async ({ date }) => {
        const { start, end } = dayRange(date)
        const rows = await prisma.attendanceSummary.findMany({
            where: { date: { gte: start, lt: end } },
            include: { rawRecords: true },
        })
        return { count: rows.length, rows }
    },
})

export const getLeaveRecords = new FunctionTool({
    name: "get_leave_records",
    description: "Fetch LeaveRequest and Leave rows overlapping a given date.",
    parameters: dateParam,
    execute: async ({ date }) => {
        const { start, end } = dayRange(date)
        const [leaveRequests, leaves] = await Promise.all([
            prisma.leaveRequest.findMany({
                where: { startDate: { lte: end }, endDate: { gte: start } },
            }),
            prisma.leave.findMany({
                where: { startDate: { lte: end }, endDate: { gte: start } },
            }),
        ])
        return { leaveRequests, leaves }
    },
})

export const getAmendRequests = new FunctionTool({
    name: "get_amend_requests",
    description: "Fetch AttendanceRequest rows (amend records) for a given date.",
    parameters: dateParam,
    execute: async ({ date }) => {
        const { start, end } = dayRange(date)
        const rows = await prisma.attendanceRequest.findMany({
            where: { date: { gte: start, lt: end } },
        })
        return { count: rows.length, rows }
    },
})

export const getUsersLite = new FunctionTool({
    name: "get_users_lite",
    description: "Fetch a lightweight list of users (id, name, email, isArchived, deletedAt) to cross-reference records against stale/archived/missing users.",
    parameters: z.object({}),
    execute: async () => {
        const rows = await prisma.user.findMany({
            select: { id: true, name: true, email: true, isArchived: true, deletedAt: true },
        })
        return { count: rows.length, rows }
    },
})

export const selfCheckTools = [getAttendanceSummaries, getLeaveRecords, getAmendRequests, getUsersLite]
