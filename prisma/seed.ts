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

    // Set marcr@redadair.com.au as ADMIN and MANAGER
    await prisma.user.upsert({
        where: { email: 'marcr@redadair.com.au' },
        update: {
            roles: [Role.ADMIN, Role.MANAGER, Role.USER]
        },
        create: {
            email: 'marcr@redadair.com.au',
            name: 'Marcr Admin',
            roles: [Role.ADMIN, Role.MANAGER, Role.USER],
            departmentId: managementDept.id
        }
    })

    console.log('Employees created')
    console.log('Seed completed successfully!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
