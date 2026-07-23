import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { sendAdminActionEmail } from '@/lib/email'
import { broadcastUpdate } from '@/lib/eventBus'
import { invalidateCache, CacheKeys } from '@/lib/cache'

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await req.json()
        const session = await auth() as any
        console.log(`Updating employee ${id} with body:`, JSON.stringify(body, null, 2))

        const { name, email, departmentId, roles, managerId, isArchived, location, shiftStartTime, secondaryDepartmentIds, workingDays, isTechnician, technicianDisplayName, technicianArchivedAt } = body
        const updateData: any = {}
        if (name !== undefined) updateData.name = name
        if (email !== undefined) updateData.email = email

        // Technician-board fields are admin-only (add a server-side gate scoped to
        // just these fields — the rest of this route mirrors existing behaviour).
        const touchesTechnician = isTechnician !== undefined || technicianDisplayName !== undefined || technicianArchivedAt !== undefined
        if (touchesTechnician) {
            const actorRoles: string[] = session?.user?.roles || []
            if (!actorRoles.includes('ADMIN')) {
                return NextResponse.json({ error: 'Only admins can manage technicians' }, { status: 403 })
            }
            if (isTechnician !== undefined) updateData.isTechnician = isTechnician === true
            if (technicianDisplayName !== undefined) {
                updateData.technicianDisplayName = technicianDisplayName ? String(technicianDisplayName).trim() : null
            }
            if (technicianArchivedAt !== undefined) {
                updateData.technicianArchivedAt = technicianArchivedAt ? new Date(technicianArchivedAt) : null
            }
        }

        // Use relation updates instead of scalars as the client seems out of sync
        if (departmentId !== undefined) {
            const val = (departmentId && departmentId !== "unassigned") ? departmentId : null
            updateData.department = val ? { connect: { id: val } } : { disconnect: true }
        }

        if (roles !== undefined && Array.isArray(roles)) {
            const validRoles = ['DEVELOPER', 'ADMIN', 'MANAGER', 'OPERATIONS', 'VIEWER', 'USER']
            const invalid = roles.filter((r: string) => !validRoles.includes(r))
            if (invalid.length) {
                return NextResponse.json({ error: `Invalid role(s): ${invalid.join(', ')}` }, { status: 400 })
            }
            updateData.roles = { set: roles }
        }

        if (managerId !== undefined) {
            const val = (managerId && managerId !== "unassigned") ? managerId : null
            updateData.manager = val ? { connect: { id: val } } : { disconnect: true }
        }

        if (isArchived !== undefined) updateData.isArchived = isArchived
        if (location !== undefined) {
            updateData.employmentLocation = location
            // SYNC: Update timezone based on location for primary regions
            if (location === 'Philippines') {
                updateData.selectedTimezone = 'Asia/Manila'
                updateData.useCurrentTimezone = false
            } else if (location === 'Australia') {
                updateData.selectedTimezone = 'Australia/Sydney'
                updateData.useCurrentTimezone = false
            }
        }
        if (shiftStartTime !== undefined) updateData.shiftStartTime = shiftStartTime
        if (body.shiftEndTime !== undefined) updateData.shiftEndTime = body.shiftEndTime
        if (workingDays !== undefined) updateData.workingDays = Array.isArray(workingDays) ? workingDays.join(',') : workingDays
        if (secondaryDepartmentIds !== undefined) {
            updateData.secondaryDepartments = {
                set: Array.isArray(secondaryDepartmentIds)
                    ? secondaryDepartmentIds.map((id: string) => ({ id }))
                    : []
            }
        }

        console.log("Applying Prisma update with data:", JSON.stringify(updateData, null, 2))

        const updated = await prisma.user.update({
            where: { id },
            data: updateData,
            include: { accounts: true }
        })

        // Notify the employee when an admin edits their profile (skip self-edits)
        if (session?.user?.id && session.user.id !== id) {
            const changedFields: string[] = []
            if (name !== undefined) changedFields.push('name')
            if (email !== undefined) changedFields.push('email')
            if (departmentId !== undefined) changedFields.push('department')
            if (roles !== undefined) changedFields.push('roles')
            if (managerId !== undefined) changedFields.push('reporting manager')
            if (location !== undefined) changedFields.push('work location')
            if (shiftStartTime !== undefined || body.shiftEndTime !== undefined) changedFields.push('shift hours')
            if (secondaryDepartmentIds !== undefined) changedFields.push('secondary departments')
            if (workingDays !== undefined) changedFields.push('working days')
            if (isArchived !== undefined) changedFields.push('account status')

            const changedSummary = changedFields.length > 0 ? changedFields.join(', ') : 'profile details'

            await prisma.notification.create({
                data: {
                    userId: id,
                    title: "Your Profile Was Updated",
                    message: `${session.user.name || 'An administrator'} has updated your profile (${changedSummary}).`,
                    type: "ADMIN_ACTION",
                    link: "/user"
                }
            })
            broadcastUpdate('notification', { userId: id })

            const empAccount = updated.accounts?.find((a: any) => a.provider === 'google')
            if (empAccount?.access_token && updated.email) {
                await sendAdminActionEmail({
                    userName: updated.name || "Employee",
                    userEmail: updated.email,
                    adminName: session.user.name || "Administrator",
                    adminEmail: session.user.email,
                    adminAccessToken: session.accessToken || empAccount.access_token,
                    actionType: 'ATTENDANCE',
                    details: `Your profile has been updated by an administrator. Fields changed: ${changedSummary}.`,
                    date: new Date().toLocaleDateString(),
                    adminRefreshToken: session.refreshToken
                })
            }
        }

        void invalidateCache(CacheKeys.employees, CacheKeys.managers, CacheKeys.staffDashboard)
        return NextResponse.json(updated)
    } catch (error) {
        console.error("Update employee error details:", error)
        return NextResponse.json({ error: 'Failed to update employee: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.user.update({
            where: { id },
            data: { deletedAt: new Date() }
        })
        void invalidateCache(CacheKeys.employees, CacheKeys.managers, CacheKeys.staffDashboard)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Delete employee error:", error)
        return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
    }
}
