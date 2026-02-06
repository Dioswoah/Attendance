import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * PATCH /api/user/timezone
 * Update user's timezone preferences
 */
export async function PATCH(req: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const body = await req.json()
        const { useCurrentTimezone, selectedTimezone } = body

        // Validate input
        if (typeof useCurrentTimezone !== 'boolean') {
            return NextResponse.json(
                { error: "useCurrentTimezone must be a boolean" },
                { status: 400 }
            )
        }

        if (!useCurrentTimezone && !selectedTimezone) {
            return NextResponse.json(
                { error: "selectedTimezone is required when useCurrentTimezone is false" },
                { status: 400 }
            )
        }

        // Update user preferences
        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                useCurrentTimezone,
                selectedTimezone: selectedTimezone || "UTC"
            },
            select: {
                id: true,
                useCurrentTimezone: true,
                selectedTimezone: true
            }
        })

        return NextResponse.json(updatedUser)
    } catch (error) {
        console.error("Failed to update timezone preferences:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

/**
 * GET /api/user/timezone
 * Get user's timezone preferences
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                useCurrentTimezone: true,
                selectedTimezone: true
            }
        })

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            )
        }

        return NextResponse.json(user)
    } catch (error) {
        console.error("Failed to get timezone preferences:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
