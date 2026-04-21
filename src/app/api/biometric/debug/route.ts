import { NextResponse } from "next/server"
import { auth } from "@/auth"

const SPREADSHEET_ID = "1WLQ_J5Kq5Lvcjwp7sNPcpd7ecbnsF7T3s0nuaQ_LIVw"

export async function GET() {
    const session = await auth() as any
    if (!session) {
        return NextResponse.json({ error: "No session at all — not signed in" })
    }
    if (!session?.accessToken) {
        return NextResponse.json({
            error: "Session exists but no accessToken",
            sessionKeys: Object.keys(session),
            user: session.user?.email,
            expires: session.expires
        })
    }

    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${session.accessToken}` }
        })
        const json = await res.json()
        if (!res.ok) return NextResponse.json({ error: json.error?.message, status: res.status, detail: json })
        const tabs = json.sheets?.map((s: any) => s.properties?.title) ?? []
        return NextResponse.json({ ok: true, tabs, user: session.user?.email })
    } catch (e: any) {
        return NextResponse.json({ error: e.message })
    }
}
