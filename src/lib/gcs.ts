import { Storage } from "@google-cloud/storage"

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || "attendance-medical-certs-buoyant-purpose-475203-t9"

function getStorageClient(): Storage {
    const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (rawJson) {
        try {
            const credentials = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson
            return new Storage({
                credentials,
                projectId: credentials.project_id || process.env.GOOGLE_CLOUD_PROJECT
            })
        } catch (e) {
            console.error("[GCS] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", e)
        }
    }
    return new Storage()
}

/**
 * Upload a file buffer to GCS under medical-certs/{leaveRequestId}/{timestamp}-{filename}
 * Returns the GCS object path (not a public URL).
 */
export async function uploadMedicalCert(
    leaveRequestId: string,
    filename: string,
    buffer: Buffer,
    contentType: string
): Promise<string> {
    const storage = getStorageClient()
    const sanitised = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
    const objectPath = `medical-certs/${leaveRequestId}/${Date.now()}-${sanitised}`

    const bucket = storage.bucket(BUCKET_NAME)
    const file = bucket.file(objectPath)

    await file.save(buffer, {
        contentType,
        metadata: { cacheControl: "private, no-cache" },
    })

    return objectPath
}

/**
 * Generate a short-lived signed URL (15 minutes) for a GCS object path.
 */
export async function getSignedUrl(objectPath: string): Promise<string> {
    const storage = getStorageClient()
    const bucket = storage.bucket(BUCKET_NAME)
    const file = bucket.file(objectPath)

    const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    })

    return url
}

/**
 * Delete a GCS object by path (used when a leave request is cancelled/deleted).
 */
export async function deleteMedicalCert(objectPath: string): Promise<void> {
    const storage = getStorageClient()
    const bucket = storage.bucket(BUCKET_NAME)
    try {
        await bucket.file(objectPath).delete()
    } catch {
        // ignore if not found
    }
}
