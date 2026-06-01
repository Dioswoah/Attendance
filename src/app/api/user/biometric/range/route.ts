import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { google } from "googleapis"

const SPREADSHEET_ID = "1WLQ_J5Kq5Lvcjwp7sNPcpd7ecbnsF7T3s0nuaQ_LIVw"

function buildTabCandidates(dateParam: string) {
    const dateObj = new Date(dateParam + "T12:00:00")
    const monthLong = dateObj.toLocaleDateString("en-US", { month: "long" })
    const day = dateObj.getDate()
    const year = dateObj.getFullYear()
    return [
        `${monthLong} ${day} ${year}`,
        `${monthLong} ${day}, ${year}`,
        `${monthLong} ${String(day).padStart(2, "0")} ${year}`,
    ]
}

function normName(s: string) {
    return s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
}

function parseTimeToMs(date: string, timeStr: string): number {
    if (!timeStr) return 0
    const [h, m] = timeStr.split(":").map(Number)
    const d = new Date(date + "T00:00:00")
    d.setHours(h || 0, m || 0, 0, 0)
    return d.getTime()
}

function buildRecord(
    date: string,
    appRecord: any,
    bio: { firstIn: string | null; lastOut: string | null } | null
) {
    const appClockIn = appRecord?.clockIn?.toISOString() ?? null
    const appClockOut = appRecord?.clockOut?.toISOString() ?? null
    const bioFirstIn = bio?.firstIn ?? null

    let diffMinutes: number | null = null
    let status: "match" | "discrepancy" | "no_biometric" | "absent" = "absent"

    if (appClockIn && bioFirstIn) {
        const bioMs = parseTimeToMs(date, bioFirstIn)
        const appMs = new Date(appClockIn).getTime()
        diffMinutes = Math.round(Math.abs(appMs - bioMs) / 60000)
        status = diffMinutes <= 15 ? "match" : "discrepancy"
    } else if (appClockIn && !bioFirstIn) {
        status = "no_biometric"
    } else {
        status = "absent"
    }

    return {
        date,
        appClockIn,
        appClockOut,
        appStatus: appRecord?.status ?? null,
        bioFirstIn,
        bioLastOut: bio?.lastOut ?? null,
        diffMinutes,
        status,
    }
}

export async function GET(req: Request) {
    const session = await auth() as any
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.location !== "Philippines") {
        return NextResponse.json({ error: "Not available for your employment location" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    if (!startDate || !endDate) {
        return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 })
    }

    // Generate working days in range (max 14)
    const workingDays: string[] = []
    const cur = new Date(startDate + "T12:00:00Z")
    const end = new Date(endDate + "T12:00:00Z")
    while (cur <= end && workingDays.length < 14) {
        const day = cur.getUTCDay()
        if (day !== 0 && day !== 6) workingDays.push(cur.toISOString().split("T")[0])
        cur.setUTCDate(cur.getUTCDate() + 1)
    }

    const userId = session.user.id

    // Single DB round-trip for all attendance + user name
    const [appRecords, dbUser] = await Promise.all([
        prisma.attendance.findMany({
            where: {
                userId,
                date: {
                    gte: new Date(startDate + "T00:00:00Z"),
                    lte: new Date(endDate + "T23:59:59Z"),
                },
            },
        }),
        prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        }),
    ])

    const userName = dbUser?.name || ""
    const userNorm = normName(userName)
    const userParts = userNorm.split(" ").filter((p) => p.length > 2)

    // Pre-fetch spreadsheet tab list once (service account strategy)
    let sheetsClient: any = null
    let sheetsTabs: string[] | null = null
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (saJson) {
        try {
            const sa = JSON.parse(saJson)
            const authClient = new google.auth.JWT({
                email: sa.client_email,
                key: sa.private_key,
                scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
            })
            sheetsClient = google.sheets({ version: "v4", auth: authClient })
            const metaRes = await sheetsClient.spreadsheets.get({
                spreadsheetId: SPREADSHEET_ID,
                fields: "sheets.properties.title",
            })
            sheetsTabs = metaRes.data.sheets?.map((s: any) => s.properties?.title || "") ?? []
        } catch {
            sheetsTabs = null
        }
    }

    async function fetchRowsForDate(dateParam: string): Promise<any[][] | null> {
        // Strategy 1: Apps Script (no auth, preferred)
        const appsScriptUrl = process.env.BIOMETRIC_APPS_SCRIPT_URL
        if (appsScriptUrl) {
            try {
                const res = await fetch(`${appsScriptUrl}?date=${dateParam}`, { cache: "no-store" })
                if (res.ok) {
                    const json = await res.json()
                    if (json.rows) return json.rows
                }
            } catch { }
        }

        // Strategy 2: Service account (reuses pre-fetched tab list)
        if (sheetsClient && sheetsTabs) {
            try {
                const candidates = buildTabCandidates(dateParam)
                const tab = sheetsTabs.find((t) =>
                    candidates.some((c) => c.toLowerCase() === t.toLowerCase())
                )
                if (!tab) return null
                const dataRes = await sheetsClient.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `'${tab}'!A2:J1000`,
                })
                return dataRes.data.values ?? []
            } catch {
                return null
            }
        }

        return null
    }

    // Fetch all days concurrently — server-side, single client round-trip
    const records = await Promise.all(
        workingDays.map(async (date) => {
            const appRecord = appRecords.find(
                (r) => r.date.toISOString().split("T")[0] === date
            )

            try {
                const rows = await fetchRowsForDate(date)
                if (!rows) return buildRecord(date, appRecord, null)

                const bioRow = rows.find((row: any[]) => {
                    const bioName = String(row[3] || "").trim()
                    if (!bioName) return false
                    const bioNorm = normName(bioName)
                    if (bioNorm === userNorm) return true
                    const bioParts = bioNorm.split(" ").filter((p: string) => p.length > 2)
                    return (
                        userParts.filter((p: string) => bioNorm.includes(p)).length >=
                        Math.min(2, userParts.length)
                    )
                })

                const bio = bioRow
                    ? {
                        firstIn: bioRow[5] ? String(bioRow[5]).trim() : null,
                        lastOut: bioRow[6] ? String(bioRow[6]).trim() : null,
                    }
                    : null

                return buildRecord(date, appRecord, bio)
            } catch {
                return buildRecord(date, appRecord, null)
            }
        })
    )

    return NextResponse.json({ records })
}
