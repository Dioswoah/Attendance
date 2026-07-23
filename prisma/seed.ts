import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting database seed...')

    // Create departments
    const bapDept = await prisma.department.upsert({
        where: { name: 'BAP Team' },
        update: {},
        create: {
            name: 'BAP Team'
        }
    })

    const fireDept = await prisma.department.upsert({
        where: { name: 'Fire Industry Academy' },
        update: {},
        create: {
            name: 'Fire Industry Academy'
        }
    })

    const financeDept = await prisma.department.upsert({
        where: { name: 'Finance' },
        update: {},
        create: {
            name: 'Finance'
        }
    })

    const managementDept = await prisma.department.upsert({
        where: { name: 'Management' },
        update: {},
        create: {
            name: 'Management'
        }
    })

    console.log('Departments created')

    // Create employees
    const employees = [
        { id: 'beau', name: 'Beau Hannan', email: 'beau@redadair.com', departmentId: fireDept.id, roles: [Role.USER] },
        { id: 'cherry', name: 'Cherry Celeste', email: 'cherry@redadair.com', departmentId: fireDept.id, roles: [Role.USER] },
        { id: 'chris', name: 'Chris Wyborn', email: 'chris@redadair.com', departmentId: fireDept.id, roles: [Role.USER] },
        { id: 'garry', name: 'Garry Gent', email: 'garry@redadair.com', departmentId: fireDept.id, roles: [Role.USER] },
        { id: 'bryan', name: 'Bryan Morales', email: 'bryan@redadair.com', departmentId: bapDept.id, roles: [Role.USER] },
        { id: 'john', name: 'John Cedric Ureta', email: 'john@redadair.com', departmentId: bapDept.id, roles: [Role.USER] },
        { id: 'carol', name: 'Carol', email: 'carol@redadair.com', departmentId: financeDept.id, roles: [Role.USER] },
        { id: 'edsel', name: 'Edsel Bukis', email: 'edsel@redadair.com', departmentId: managementDept.id, roles: [Role.ADMIN] },
    ]

    for (const emp of employees) {
        await prisma.user.upsert({
            where: { email: emp.email },
            update: {
                roles: emp.roles
            },
            create: emp
        })
    }

    // Set marcr@redadair.com.au as ADMIN, MANAGER and DEVELOPER. The seed runs
    // on every prod deploy, so this list is what his roles get reset to —
    // keep it in sync with roles granted directly in the DB (DEVELOPER is
    // required for his v1 API key to keep authenticating).
    await prisma.user.upsert({
        where: { email: 'marcr@redadair.com.au' },
        update: {
            roles: [Role.ADMIN, Role.MANAGER, Role.USER, Role.DEVELOPER]
        },
        create: {
            email: 'marcr@redadair.com.au',
            name: 'Marcr Admin',
            roles: [Role.ADMIN, Role.MANAGER, Role.USER, Role.DEVELOPER],
            departmentId: managementDept.id
        }
    })

    console.log('Employees created')

    await backfillTechnicians()

    console.log('Seed completed successfully!')
}

// ── Technician backfill (idempotent, non-destructive) ──────────────────────
// Flags the existing simPRO field-roster users as technicians so the DB-driven
// Technicians board shows them. Self-contained (this file runs in the deploy
// image, which does NOT include src/). Guarded on technicianDisplayName === null
// so it only ever acts ONCE per user: safe to run on every deploy and it never
// re-flags someone an admin later removed from the board. Each row is wrapped so
// a single failure (e.g. a simproEmployeeId unique clash) can never fail deploy.
const TECHNICIAN_ROSTER: { simproEmployeeId: number; email: string; displayName: string }[] = [
    { simproEmployeeId: 1799, email: 'michael.lowe@redadair.com.au', displayName: 'Michael Lowe' },
    { simproEmployeeId: 1834, email: 'stefane@redadair.com.au', displayName: 'Stefan Engsall' },
    { simproEmployeeId: 965, email: 'peterc@redadair.com.au', displayName: 'Peter Cross' },
    { simproEmployeeId: 1298, email: 'clintp@redadair.com.au', displayName: 'Clint Parkes' },
    { simproEmployeeId: 1581, email: 'muhammads@redadair.com.au', displayName: 'Muhammad Soban' },
    { simproEmployeeId: 150, email: 'brettr@redadair.com.au', displayName: 'Brett Roberts' },
    { simproEmployeeId: 1753, email: 'joshr@redadair.com.au', displayName: 'Josh Roger' },
    { simproEmployeeId: 1836, email: 'shayank@redadair.com.au', displayName: 'Shayan Kharaghani' },
    { simproEmployeeId: 1838, email: 'simons@redadair.com.au', displayName: 'Simon Sleiman' },
    { simproEmployeeId: 1243, email: 'rumirag@redadair.com.au', displayName: 'Rumira Gluszko-Hardes' },
    { simproEmployeeId: 911, email: 'adams@redadair.com.au', displayName: 'Adam Swindail' },
    { simproEmployeeId: 883, email: 'benjaminw@redadair.com.au', displayName: 'Benjamin Warner' },
    { simproEmployeeId: 1751, email: 'brendanj@redadair.com.au', displayName: 'Brendan Jones' },
    { simproEmployeeId: 915, email: 'briana@redadair.com.au', displayName: 'Brian Attard' },
    { simproEmployeeId: 1395, email: 'michealk@redadair.com.au', displayName: 'Micheal Keough' },
    { simproEmployeeId: 1080, email: 'paull@redadair.com.au', displayName: 'Paul Lloyd' },
    { simproEmployeeId: 1616, email: 'robs@redadair.com.au', displayName: 'Rob Searle' },
    { simproEmployeeId: 1870, email: 'dechlanm@redadair.com.au', displayName: 'Dechlan McGarrity' },
    { simproEmployeeId: 1897, email: 'dylanj@redadair.com.au', displayName: 'Dylan Jackson' },
    { simproEmployeeId: 1901, email: 'harveyl@redadair.com.au', displayName: 'Harvey Leyden' },
    { simproEmployeeId: 1910, email: 'mitchelld@redadair.com.au', displayName: 'Mitchell Dawson' },
    { simproEmployeeId: 1916, email: 'nicholasa@redadair.com.au', displayName: 'Nick Agoratsios' },
    { simproEmployeeId: 1914, email: 'saleshc@redadair.com.au', displayName: 'Salesh Chand' },
    { simproEmployeeId: 1919, email: 'jordanp@redadair.com.au', displayName: 'Jordan Price' },
    { simproEmployeeId: 15, email: 'ryang@redadair.com.au', displayName: 'Ryan Gordon' },
    { simproEmployeeId: 1873, email: 'haydenw@redadair.com.au', displayName: 'Hayden White' },
    { simproEmployeeId: 1875, email: 'mitchellp@redadair.com.au', displayName: 'Mitchell Pearce' },
]

async function backfillTechnicians() {
    let flagged = 0
    for (const entry of TECHNICIAN_ROSTER) {
        try {
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { simproEmployeeId: entry.simproEmployeeId },
                        { email: { equals: entry.email, mode: 'insensitive' } },
                    ],
                    deletedAt: null,
                },
                select: { id: true, technicianDisplayName: true, simproEmployeeId: true },
            })
            // Only act on users never processed before — this makes the backfill a
            // safe one-time flip that survives repeated deploys and does NOT undo a
            // later "remove from board" (isTechnician=false) admin action.
            if (!user || user.technicianDisplayName != null) continue
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    isTechnician: true,
                    technicianDisplayName: entry.displayName,
                    ...(user.simproEmployeeId == null ? { simproEmployeeId: entry.simproEmployeeId } : {}),
                },
            })
            flagged++
        } catch (e) {
            console.error(`[seed] technician backfill skipped for ${entry.email}:`, e instanceof Error ? e.message : e)
        }
    }
    console.log(`Technician backfill: ${flagged} newly flagged`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
