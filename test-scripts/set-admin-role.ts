/**
 * Quick Role Update Script
 * 
 * This script updates a user's role to MANAGER or ADMIN
 * Run with: npx tsx set-admin-role.ts
 */

import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function setAdminRole() {
    console.log('🔧 Updating user roles...\n')

    // EMAIL to update
    const EMAIL_TO_UPDATE = 'marcr@redadair.com.au'

    // Multi-roles for the user
    const NEW_ROLE: Role[] = [Role.ADMIN, Role.MANAGER, Role.USER]

    try {
        // Find the user
        const user = await prisma.user.findUnique({
            where: { email: EMAIL_TO_UPDATE }
        })

        if (!user) {
            console.log(`❌ User with email "${EMAIL_TO_UPDATE}" not found!`)
            console.log('\n💡 Make sure you sign in to the User Portal first to create your account.')
            return
        }

        // Update the user's roles
        const updatedUser = await prisma.user.update({
            where: { email: EMAIL_TO_UPDATE },
            data: {
                roles: NEW_ROLE
            }
        })

        console.log('✅ User role updated successfully!\n')
        console.log('📧 Email:', updatedUser.email)
        console.log('👤 Name:', updatedUser.name)
        console.log('🎭 Roles:', updatedUser.roles.join(', '))
        console.log('\n🔄 Please sign out and sign back in to see the Manager Control menu!')

    } catch (error) {
        console.error('❌ Error updating user role:', error)
    } finally {
        await prisma.$disconnect()
    }
}

setAdminRole()
