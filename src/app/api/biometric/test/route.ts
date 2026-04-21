import { NextResponse } from "next/server"

export async function GET() {
    const url = process.env.BIOMETRIC_APPS_SCRIPT_URL
    if (!url) return NextResponse.json({ error: "BIOMETRIC_APPS_SCRIPT_URL not set in .env" })

    try {
        const testDate = "2026-04-20"
        const res = await fetch(`${url}?date=${testDate}`, {
            cache: "no-store",
            redirect: "follow"
        })
        const text = await res.text()
        const isJson = text.trim().startsWith("{") || text.trim().startsWith("[")
        return NextResponse.json({
            url,
            status: res.status,
            ok: res.ok,
            finalUrl: res.url,
            isJson,
            preview: text.slice(0, 500),
            parsed: isJson ? JSON.parse(text) : null
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message, url })
    }
}
