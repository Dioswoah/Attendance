import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { uploadMedicalCert } from "@/lib/gcs"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]

export async function POST(req: NextRequest) {
    try {
        const session = await auth() as any
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get("file") as File | null
        // A pending leave lives in LeaveRequest (leaveRequestId); an approved leave
        // granted by a manager/admin lives in Leave (leaveId). Support both.
        const leaveRequestId = formData.get("leaveRequestId") as string | null
        const leaveId = formData.get("leaveId") as string | null

        if (!file || (!leaveRequestId && !leaveId)) {
            return NextResponse.json({ error: "Missing file or leave id" }, { status: 400 })
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "Invalid file type. Only PDF and images are allowed." }, { status: 400 })
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "File too large. Maximum size is 10 MB." }, { status: 400 })
        }

        const model = leaveId ? "leave" : "leaveRequest"
        const recordId = (leaveId || leaveRequestId) as string

        // Verify the record exists and belongs to the caller (or caller is admin/manager)
        const record = await (prisma as any)[model].findUnique({
            where: { id: recordId },
        })

        if (!record) {
            return NextResponse.json({ error: "Leave record not found" }, { status: 404 })
        }

        const userRoles: string[] = session.user.roles || []
        const isOwner = record.userId === session.user.id
        const isPrivileged = userRoles.includes("ADMIN") || userRoles.includes("MANAGER")

        if (!isOwner && !isPrivileged) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Read file buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload to GCS
        const objectPath = await uploadMedicalCert(recordId, file.name, buffer, file.type)

        // Save the path back to the originating record
        await (prisma as any)[model].update({
            where: { id: recordId },
            data: { attachmentPath: objectPath },
        })

        return NextResponse.json({ path: objectPath })
    } catch (error: any) {
        console.error("Upload error:", error)
        return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }
}
