import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { processSimproWebhookEvent } from '@/lib/simpro-attendance'

export const dynamic = 'force-dynamic'

// Receiver for simPRO webhook events (job status changes fired by mobile
// actions like "start travel"). We never call back into simPRO from here —
// the event just triggers our own read-only fetch + (flag-gated) clock-in.
//
// If SIMPRO_WEBHOOK_SECRET is set, the request must carry a matching HMAC
// signature (simPRO signs the payload with the subscription secret) or the
// secret itself in a header/query param.
function isAuthorized(request: Request, rawBody: string): boolean {
    const secret = process.env.SIMPRO_WEBHOOK_SECRET
    if (!secret) return true

    const url = new URL(request.url)
    const provided =
        request.headers.get('x-response-signature') ||
        request.headers.get('x-signature') ||
        request.headers.get('x-webhook-secret') ||
        url.searchParams.get('secret') ||
        ''
    if (!provided) return false
    if (provided === secret) return true

    for (const algo of ['sha1', 'sha256'] as const) {
        const hmac = crypto.createHmac(algo, secret).update(rawBody).digest('hex')
        const candidate = provided.replace(/^(sha1|sha256)=/, '')
        if (candidate.length === hmac.length &&
            crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hmac))) {
            return true
        }
    }
    return false
}

export async function POST(request: Request) {
    try {
        const rawBody = await request.text()
        if (!isAuthorized(request, rawBody)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        let event: { ID?: string; date_triggered?: string; reference?: { companyID?: number; jobID?: number } } = {}
        try {
            event = JSON.parse(rawBody)
        } catch {
            // some webhook test pings send empty/non-JSON bodies — accept them
        }
        console.log(`[simPRO] webhook received: ${event.ID ?? '(no event id)'} at ${event.date_triggered ?? new Date().toISOString()}`)

        // Respond fast; resolve which tech(s) this job/schedule actually
        // belongs to today and only refresh those, in the background.
        processSimproWebhookEvent(
            event.reference ? { companyId: event.reference.companyID, jobId: event.reference.jobID } : null,
        ).catch((e) => console.error('[simPRO] webhook-triggered processing failed:', e))

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('[simPRO] webhook handler failed:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}

// simPRO sends a GET/HEAD probe when a subscription is created.
export async function GET() {
    return NextResponse.json({ ok: true })
}
