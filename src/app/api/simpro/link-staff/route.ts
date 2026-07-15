import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { SIMPRO_FIELD_ROSTER } from '@/lib/simpro-roster'
import { logActivity } from '@/lib/db-utils'

export const dynamic = 'force-dynamic'

// One-shot linker: stamps simproEmployeeId onto RSA users matched by their
// Workspace email. Idempotent — safe to run again after new techs are added.
export async function POST() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const roles = session.user.roles || []
        if (!roles.includes('ADMIN') && !roles.includes('DEVELOPER')) {
            return NextResponse.json({ error: 'Only admins can link simPRO staff' }, { status: 403 })
        }

        const linked: string[] = []
        const alreadyLinked: string[] = []
        const noRsaUser: string[] = []
        const conflicts: string[] = []

        for (const tech of SIMPRO_FIELD_ROSTER) {
            const user = await prisma.user.findFirst({
                where: { email: { equals: tech.rsaEmail, mode: 'insensitive' }, deletedAt: null },
                select: { id: true, simproEmployeeId: true },
            })
            if (!user) {
                noRsaUser.push(`${tech.displayName} (${tech.rsaEmail})`)
                continue
            }
            if (user.simproEmployeeId === tech.simproEmployeeId) {
                alreadyLinked.push(tech.displayName)
                continue
            }
            const holder = await prisma.user.findFirst({
                where: { simproEmployeeId: tech.simproEmployeeId, NOT: { id: user.id } },
                select: { email: true },
            })
            if (holder) {
                conflicts.push(`${tech.displayName}: simPRO ID ${tech.simproEmployeeId} already linked to ${holder.email}`)
                continue
            }
            await prisma.user.update({
                where: { id: user.id },
                data: { simproEmployeeId: tech.simproEmployeeId },
            })
            linked.push(tech.displayName)
        }

        logActivity({
            userId: session.user.id,
            action: 'SIMPRO_LINK_STAFF',
            entityType: 'USER',
            details: { linked, alreadyLinked, noRsaUser, conflicts },
        }).catch(() => {})

        return NextResponse.json({
            success: true,
            rosterSize: SIMPRO_FIELD_ROSTER.length,
            linked,
            alreadyLinked,
            noRsaUser,
            conflicts,
        })
    } catch (error) {
        console.error('[simPRO] link-staff failed:', error)
        return NextResponse.json({ error: 'Failed to link simPRO staff' }, { status: 500 })
    }
}
