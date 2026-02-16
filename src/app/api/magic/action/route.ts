import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMagicLink } from '@/lib/magic-link'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const ts = searchParams.get('ts')
    const sig = searchParams.get('sig')

    if (!userId || !action || !ts || !sig) {
        return new NextResponse('Invalid Link: Missing parameters', { status: 400 })
    }

    // Verify token
    try {
        const isValid = verifyMagicLink(userId, action, ts, sig)
        if (!isValid) {
            return new NextResponse('Invalid Link: Signature mismatch or expired token', { status: 403 })
        }
    } catch (e) {
        return new NextResponse('Invalid Link: Verification failed', { status: 500 })
    }

    const now = new Date()
    let message = ""

    try {
        if (action === 'clock-in') {
            // Clock In Logic
            // Check if already active
            const active = await prisma.attendance.findFirst({
                where: { userId, clockOut: null, deletedAt: null }
            })
            if (active) {
                message = "You are already clocked in!"
            } else {
                await prisma.attendance.create({
                    data: {
                        userId,
                        date: new Date(), // using UTC today might be slightly off if user is in diff timezone but for quick clock in its prob ok. Ideally fetch user timezone.
                        clockIn: now,
                        status: 'PRESENT',
                        mode: 'OFFICE'
                    }
                })
                await prisma.user.update({ where: { id: userId }, data: { availabilityStatus: 'AVAILABLE' } })
                message = "Successfully Clocked In!"
            }
        } else if (action === 'clock-out') {
            // Clock Out Logic
            const active = await prisma.attendance.findFirst({
                where: { userId, clockOut: null, deletedAt: null }
            })
            if (!active) {
                message = "No active session found to clock out from."
            } else {
                await prisma.attendance.update({
                    where: { id: active.id },
                    data: {
                        clockOut: now,
                        status: 'PRESENT'
                    }
                })
                // Close breaks too
                await prisma.break.updateMany({
                    where: { attendanceId: active.id, endTime: null, deletedAt: null },
                    data: { endTime: now }
                })
                await prisma.user.update({ where: { id: userId }, data: { availabilityStatus: 'APPEAR_OFFLINE' } })
                message = "Successfully Clocked Out!"
            }
        } else if (action === 'end-break') {
            // End Break Logic
            const active = await prisma.attendance.findFirst({
                where: { userId, clockOut: null, deletedAt: null }
            })
            if (!active) {
                message = "No active session found."
            } else {
                // Close latest break
                const formatNow = new Date()
                const latestBreak = await prisma.break.findFirst({
                    where: { attendanceId: active.id, endTime: null, deletedAt: null },
                    orderBy: { startTime: 'desc' }
                })
                if (latestBreak) {
                    await prisma.break.update({
                        where: { id: latestBreak.id },
                        data: { endTime: formatNow }
                    })
                    // also update legacy breakEnd
                    await prisma.attendance.update({
                        where: { id: active.id },
                        data: { breakEnd: formatNow }
                    })
                    await prisma.user.update({ where: { id: active.userId }, data: { availabilityStatus: 'AVAILABLE' } })
                    message = "Break Ended Successfully!"
                } else {
                    message = "No active break found."
                }
            }
        } else {
            return new NextResponse('Invalid Action', { status: 400 })
        }

        // Return a simple HTML Success Page
        return new NextResponse(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Action Complete</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f3f4f6; }
                    .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; }
                    h1 { color: #10b981; margin-bottom: 1rem; }
                    p { color: #4b5563; margin-bottom: 2rem; }
                    a { display: inline-block; background: #2563eb; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; }
                    a:hover { background: #1d4ed8; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>✅ Success</h1>
                    <p>${message}</p>
                    <a href="/user">Go to Dashboard</a>
                </div>
                <script>
                    // Close tab automatically after 3 seconds if opened via magic link? 
                    // No, let user decide. Or auto-redirect.
                    setTimeout(() => {
                        window.location.href = '/user';
                    }, 3000);
                </script>
            </body>
            </html>
        `, {
            headers: { 'Content-Type': 'text/html' }
        })

    } catch (e) {
        console.error("Magic Action Error:", e)
        return new NextResponse("Internal Server Error processing action", { status: 500 })
    }
}
