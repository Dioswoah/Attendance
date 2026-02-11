/**
 * Update Test User #1 to ADMIN role
 * Run with: npx tsx update-test-user.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateTestUser() {
    console.log('🔧 Updating TEST USER #1 to ADMIN role...\n')

    try {
        // Find all users to see what we have
        const allUsers = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                roles: true
            }
        })

        console.log('📋 Current users in database:')
        allUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name} (${user.email})`)
            console.log(`   Roles: ${user.roles.join(', ')}`)
            console.log('')
        })

        // Find TEST USER #1
        const testUser = allUsers.find(u =>
            u.name?.toLowerCase().includes('test') ||
            u.email?.toLowerCase().includes('test')
        )

        if (!testUser) {
            console.log('❌ Could not find TEST USER #1')
            console.log('💡 Please sign in to the User Portal first to create your account.')
            return
        }

        console.log(`\n🎯 Found user: ${testUser.name} (${testUser.email})`)
        console.log(`📝 Current roles: ${testUser.roles.join(', ')}`)

        // Update to ADMIN
        const updated = await prisma.user.update({
            where: { id: testUser.id },
            data: {
                roles: ['ADMIN', 'MANAGER', 'USER'] as any
            }
        })

        console.log('\n✅ Successfully updated user!')
        console.log(`📝 New roles: ${updated.roles.join(', ')}`)
        console.log('\n🔄 IMPORTANT: You must SIGN OUT and SIGN BACK IN for changes to take effect!')
        console.log('   1. Go to User Portal')
        console.log('   2. Click "Sign Out" in sidebar')
        console.log('   3. Sign in again with Google')
        console.log('   4. You should now see "Manager Control" in the navigation!')

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

updateTestUser()
