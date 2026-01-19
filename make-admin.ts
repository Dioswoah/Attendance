/**
 * Update user to ADMIN role
 * Run with: npx tsx make-admin.ts YOUR_EMAIL
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function makeAdmin() {
    const email = process.argv[2]

    if (!email) {
        console.log('❌ Please provide an email address')
        console.log('Usage: npx tsx make-admin.ts YOUR_EMAIL@redadair.com')
        console.log('\n📋 Available users:')

        const users = await prisma.user.findMany({
            select: { email: true, name: true, roles: true }
        })

        users.forEach((u, i) => {
            console.log(`${i + 1}. ${u.name} - ${u.email} [${u.roles.join(', ')}]`)
        })

        await prisma.$disconnect()
        return
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email }
        })

        if (!user) {
            console.log(`❌ User with email "${email}" not found`)
            return
        }

        console.log(`\n🎯 Updating: ${user.name} (${user.email})`)
        console.log(`📝 Current roles: ${user.roles.join(', ')}`)

        const updated = await prisma.user.update({
            where: { email },
            data: {
                roles: ['ADMIN', 'MANAGER', 'USER'] as any
            }
        })

        console.log(`✅ New roles: ${updated.roles.join(', ')}`)
        console.log('\n🔄 NEXT STEPS:')
        console.log('   1. Go to http://localhost:3000/user')
        console.log('   2. Click "Sign Out"')
        console.log('   3. Sign in again')
        console.log('   4. Manager Control will appear in sidebar!')

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

makeAdmin()
