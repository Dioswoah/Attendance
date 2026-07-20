import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { xeroFetch } from '@/lib/xero'
import { logActivity } from '@/lib/db-utils'

export const dynamic = 'force-dynamic'

// Xero stores most employees under personal emails, so email match alone links
// almost nobody — fall back to a case-insensitive name match.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()

// Xero name (normalised) -> RSA email, for spelling variants no fuzzy rule should guess at
const MANUAL_ALIASES: Record<string, string> = {
    'mitchell dawnson': 'mitchelld@redadair.com.au',      // Dawnson vs Dawson
    'robert searle': 'robs@redadair.com.au',              // Robert vs Rob
    'rumira gluszkohardes': 'rumirag@redadair.com.au',    // Gluszko vs Glasko
}

// One-shot linker: stamps xeroEmployeeId onto RSA users matched by email,
// then by full name, then by first+last name token (skips middle names).
// Idempotent — safe to run again after new staff are added in Xero.
export async function POST() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const roles = session.user.roles || []
        if (!roles.includes('ADMIN') && !roles.includes('DEVELOPER')) {
            return NextResponse.json({ error: 'Only admins can link Xero staff' }, { status: 403 })
        }

        const data = await xeroFetch('/payroll.xro/1.0/Employees')
        const xeroEmployees: any[] = data.Employees || []

        const users = await prisma.user.findMany({
            where: { isArchived: false, deletedAt: null },
            select: { id: true, name: true, email: true, xeroEmployeeId: true },
        })

        const linked: string[] = []
        const alreadyLinked: string[] = []
        const unmatched: string[] = []
        const conflicts: string[] = []

        for (const emp of xeroEmployees) {
            const xeroName = `${emp.FirstName || ''} ${emp.LastName || ''}`.trim()
            const xeroEmail = (emp.Email || '').toLowerCase().trim()
            const xeroNorm = norm(xeroName)
            const xeroTokens = xeroNorm.split(' ')
            const xeroFirstLast = `${xeroTokens[0]} ${xeroTokens[xeroTokens.length - 1]}`

            const aliasEmail = MANUAL_ALIASES[xeroNorm]
            const user =
                (aliasEmail && users.find(u => u.email.toLowerCase() === aliasEmail)) ||
                users.find(u => u.email.toLowerCase() === xeroEmail && xeroEmail) ||
                users.find(u => norm(u.name || '') === xeroNorm) ||
                users.find(u => {
                    const t = norm(u.name || '').split(' ')
                    return t.length >= 2 && `${t[0]} ${t[t.length - 1]}` === xeroFirstLast
                })

            if (!user) {
                unmatched.push(`${xeroName} (${emp.Email || 'no email'})`)
                continue
            }
            if (user.xeroEmployeeId === emp.EmployeeID) {
                alreadyLinked.push(xeroName)
                continue
            }
            const holder = users.find(u => u.xeroEmployeeId === emp.EmployeeID && u.id !== user.id)
            if (holder) {
                conflicts.push(`${xeroName}: Xero ID already linked to ${holder.email}`)
                continue
            }
            await prisma.user.update({
                where: { id: user.id },
                data: { xeroEmployeeId: emp.EmployeeID },
            })
            user.xeroEmployeeId = emp.EmployeeID
            linked.push(`${xeroName} -> ${user.email}`)
        }

        logActivity({
            userId: session.user.id,
            action: 'XERO_LINK_STAFF',
            entityType: 'USER',
            details: { linked, alreadyLinked, unmatched, conflicts },
        }).catch(() => {})

        return NextResponse.json({
            success: true,
            xeroEmployees: xeroEmployees.length,
            linked,
            alreadyLinked,
            unmatched,
            conflicts,
        })
    } catch (error) {
        console.error('[Xero] link-staff failed:', error)
        return NextResponse.json({ error: 'Failed to link Xero staff' }, { status: 500 })
    }
}
