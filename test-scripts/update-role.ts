// Quick script to update user role to MANAGER or ADMIN
// Run this with: npx ts-node update-role.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateUserRole() {
    // Replace with your email address
    const userEmail = 'YOUR_EMAIL@digitalstaff.com.au' // <-- CHANGE THIS
    const newRole = 'MANAGER' // or 'ADMIN'

    try {
        const user = await prisma.user.update({
            where: { email: userEmail },
            data: {
                roles: [newRole, 'USER'] // Gives both MANAGER and USER roles
            }
        })

        console.log('✅ User role updated successfully!')
        console.log('User:', user.email)
        console.log('Roles:', user.roles)
        console.log('\n🔄 Please refresh your browser to see the Manager Control menu item')
    } catch (error) {
        console.error('❌ Error updating user role:', error)
    } finally {
        await prisma.$disconnect()
    }
}

updateUserRole()
