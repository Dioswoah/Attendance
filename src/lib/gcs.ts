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
 * Download a GCS object and return its contents as a Buffer along with metadata.
 */
export async function downloadFile(objectPath: string): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const storage = getStorageClient()
    const bucket = storage.bucket(BUCKET_NAME)
    const file = bucket.file(objectPath)

    const [metadata] = await file.getMetadata()
    const contentType = (metadata.contentType as string) || "application/octet-stream"
    const filename = objectPath.split("/").pop() || "attachment"

    const [buffer] = await file.download()
    return { buffer, contentType, filename }
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
