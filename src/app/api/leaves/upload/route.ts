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
        const leaveRequestId = formData.get("leaveRequestId") as string | null

        if (!file || !leaveRequestId) {
            return NextResponse.json({ error: "Missing file or leaveRequestId" }, { status: 400 })
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "Invalid file type. Only PDF and images are allowed." }, { status: 400 })
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "File too large. Maximum size is 10 MB." }, { status: 400 })
        }

        // Verify the leave request belongs to the caller (or caller is admin/manager)
        const leaveRequest = await (prisma as any).leaveRequest.findUnique({
            where: { id: leaveRequestId },
        })

        if (!leaveRequest) {
            return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
        }

        const userRoles: string[] = session.user.roles || []
        const isOwner = leaveRequest.userId === session.user.id
        const isPrivileged = userRoles.includes("ADMIN") || userRoles.includes("MANAGER")

        if (!isOwner && !isPrivileged) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Read file buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload to GCS
        const objectPath = await uploadMedicalCert(leaveRequestId, file.name, buffer, file.type)

        // Save the path back to the leave request
        await (prisma as any).leaveRequest.update({
            where: { id: leaveRequestId },
            data: { attachmentPath: objectPath },
        })

        return NextResponse.json({ path: objectPath })
    } catch (error: any) {
        console.error("Upload error:", error)
        return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }
}
