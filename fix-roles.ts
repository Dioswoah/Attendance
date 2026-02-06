import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixUserRoles() {
    try {
        // Find user by email pattern (assuming marc's email)
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { email: { contains: 'marc' } },
                    { email: { contains: 'redadair' } }
                ]
            },
            select: {
                id: true,
                email: true,
                name: true,
                roles: true
            }
        })

        console.log('Found users:', users)

        if (users.length === 0) {
            console.log('No users found matching the criteria')
            return
        }

        // Update the first user (Marc) to have ADMIN and MANAGER roles
        const marcUser = users[0]
        console.log(`\nUpdating user: ${marcUser.email}`)

        const updated = await prisma.user.update({
            where: { id: marcUser.id },
            data: {
                roles: ['ADMIN', 'MANAGER', 'USER']
            },
            select: {
                id: true,
                email: true,
                name: true,
                roles: true
            }
        })

        console.log('\n✅ Successfully updated user roles:')
        console.log(updated)

    } catch (error) {
        console.error('❌ Error updating roles:', error)
    } finally {
        await prisma.$disconnect()
    }
}

fixUserRoles()
