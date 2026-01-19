import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAllUsers() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            roles: true,
            department: {
                select: { name: true }
            }
        }
    })

    console.log('\n📋 ALL USERS IN DATABASE:\n')
    users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name || 'No Name'}`)
        console.log(`   Email: ${user.email}`)
        console.log(`   Roles: ${user.roles.join(', ')}`)
        console.log(`   Department: ${user.department?.name || 'Unassigned'}`)
        console.log(`   ID: ${user.id}`)
        console.log('')
    })

    await prisma.$disconnect()
}

checkAllUsers()
