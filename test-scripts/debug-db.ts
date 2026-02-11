import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        console.log('Connecting...')
        const users = await prisma.user.findMany({ take: 1 })
        console.log('Success. Found ' + users.length + ' users.')
    } catch (e: any) {
        console.error('Error:', e.message)
        if (e.code) console.error('Code:', e.code)
    } finally {
        await prisma.$disconnect()
    }
}

main()
