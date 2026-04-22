import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { google } from "googleapis"

const SPREADSHEET_ID = "1WLQ_J5Kq5Lvcjwp7sNPcpd7ecbnsF7T3s0nuaQ_LIVw"
const BASE_SHEETS = "https://sheets.googleapis.com/v4/spreadsheets"

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

// ── Strategy 1: Google Apps Script web app (preferred, no auth needed) ────────
async function fetchViaAppsScript(dateParam: string): Promise<any[] | null> {
    const appsScriptUrl = process.env.BIOMETRIC_APPS_SCRIPT_URL
    if (!appsScriptUrl) return null

    const res = await fetch(`${appsScriptUrl}?date=${dateParam}`, { cache: "no-store" })
    if (!res.ok) return null
    const json = await res.json()
    return json.rows ?? null
}

// ── Strategy 2: Service account JWT (works if sheet is shared with SA email) ──
async function fetchViaServiceAccount(dateParam: string): Promise<{ tab: string; rows: any[][] } | null> {
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!saJson) return null

    try {
        const sa = JSON.parse(saJson)
        const authClient = new google.auth.JWT({
            email: sa.client_email,
            key: sa.private_key,
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
        })
        const sheets = google.sheets({ version: "v4", auth: authClient })

        const metaRes = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            fields: "sheets.properties.title"
        })
        const allTabs = metaRes.data.sheets?.map(s => s.properties?.title || "") ?? []
        const candidates = buildTabCandidates(dateParam)
        const tab = allTabs.find(t => candidates.some(c => c.toLowerCase() === t.toLowerCase()))
        if (!tab) throw new Error(`No sheet tab for ${dateParam}. Available: ${allTabs.join(", ")}`)

        const dataRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${tab}'!A2:J1000`
        })
        return { tab, rows: dataRes.data.values ?? [] }
    } catch {
        return null
    }
}

// ── Strategy 3: Session OAuth token (requires sign-in via Google, not One Tap) ─
async function fetchViaSessionToken(dateParam: string, accessToken: string): Promise<{ tab: string; rows: any[][] }> {
    const candidates = buildTabCandidates(dateParam)
    const headers = { Authorization: `Bearer ${accessToken}` }

    const metaRes = await fetch(`${BASE_SHEETS}/${SPREADSHEET_ID}?fields=sheets.properties.title`, { headers, cache: "no-store" })
    if (!metaRes.ok) throw new Error(`Sheets API ${metaRes.status}: ${(await metaRes.json())?.error?.message}`)
    const metaJson = await metaRes.json()
    const allTabs: string[] = metaJson.sheets?.map((s: any) => s.properties?.title || "") ?? []
    const tab = allTabs.find(t => candidates.some(c => c.toLowerCase() === t.toLowerCase()))
    if (!tab) throw new Error(`No sheet for ${dateParam}. Available: ${allTabs.join(", ")}`)

    const range = encodeURIComponent(`'${tab}'!A2:J1000`)
    const dataRes = await fetch(`${BASE_SHEETS}/${SPREADSHEET_ID}/values/${range}`, { headers, cache: "no-store" })
    if (!dataRes.ok) throw new Error(`Data fetch ${dataRes.status}`)
    const dataJson = await dataRes.json()
    return { tab, rows: dataJson.values ?? [] }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get("date")
    if (!dateParam) return NextResponse.json({ error: "date param required" }, { status: 400 })

    try {
        let tab = ""
        let rawRows: any[][] = []

        // Strategy 1: Apps Script (no auth, always works if configured)
        const scriptRows = await fetchViaAppsScript(dateParam).catch(() => null)
        if (scriptRows) {
            rawRows = scriptRows
            tab = `Apps Script (${dateParam})`
        } else {
            // Strategy 2: Service account
            const saResult = await fetchViaServiceAccount(dateParam).catch(() => null)
            if (saResult) {
                tab = saResult.tab
                rawRows = saResult.rows
            } else {
                // Strategy 3: Session OAuth token
                const session = await auth() as any
                if (session?.accessToken) {
                    const result = await fetchViaSessionToken(dateParam, session.accessToken)
                    tab = result.tab
                    rawRows = result.rows
                } else {
                    return NextResponse.json({ error: "SETUP_REQUIRED" }, { status: 401 })
                }
            }
        }

        // Parse rows — A=Date B=EmpID C=PersonID D=Name E=Dept F=FirstIn G=LastOut H=ExpStart I=Status J=Late
        const biometricEntries = rawRows
            .map((row: any[]) => ({
                date: String(row[0] || ""),
                employeeId: String(row[1] || ""),
                personId: String(row[2] || ""),
                name: String(row[3] || "").trim(),
                department: String(row[4] || "").trim(),
                firstIn: row[5] ? String(row[5]).trim() : null,
                lastOut: row[6] ? String(row[6]).trim() : null,
                expectedStart: row[7] ? String(row[7]).trim() : null,
                status: String(row[8] || ""),
                lateTime: String(row[9] || "")
            }))
            .filter((e: any) => e.name !== "")

        // App attendance for the date
        const dayStart = new Date(`${dateParam}T00:00:00Z`)
        const dayEnd = new Date(`${dateParam}T23:59:59Z`)
        const appRecords = await prisma.attendance.findMany({
            where: { date: { gte: dayStart, lte: dayEnd } },
            include: { user: { include: { department: true } } }
        })
        const users = await prisma.user.findMany({
            where: { deletedAt: null, employmentLocation: "Philippines" },
            select: { id: true, name: true, department: true }
        })

        const normName = (s: string) =>
            s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()

        const combined = biometricEntries.map((bio: any) => {
            const bioNorm = normName(bio.name)
            const bioParts = bioNorm.split(" ").filter((p: string) => p.length > 2)
            const matchedUser = users.find(u => {
                if (!u.name) return false
                const uNorm = normName(u.name)
                if (uNorm === bioNorm) return true
                return bioParts.filter((p: string) => uNorm.includes(p)).length >= Math.min(2, bioParts.length)
            })
            const appRecord = matchedUser ? appRecords.find(r => r.userId === matchedUser.id) : null
            return {
                biometric: bio,
                app: appRecord ? {
                    id: appRecord.id,
                    userId: appRecord.userId,
                    userName: matchedUser?.name ?? null,
                    department: matchedUser?.department?.name ?? null,
                    clockIn: appRecord.clockIn?.toISOString() ?? null,
                    clockOut: appRecord.clockOut?.toISOString() ?? null,
                    status: appRecord.status,
                    mode: appRecord.mode
                } : null,
                matched: !!matchedUser
            }
        })

        return NextResponse.json({ date: dateParam, tab, entries: combined })
    } catch (error: any) {
        console.error("Biometric API error:", error?.message)
        return NextResponse.json({ error: error?.message || "Failed to fetch" }, { status: 500 })
    }
}
