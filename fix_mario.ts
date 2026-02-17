import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixMarioAssignment() {
    try {
        // Find Marc Ramos
        const marc = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: { contains: 'marc', mode: 'insensitive' } },
                    { name: { contains: 'Marc Ramos', mode: 'insensitive' } }
                ]
            }
        })

        if (!marc) {
            console.log('❌ Marc Ramos not found')
            return
        }

        console.log('✅ Found Marc Ramos:', marc.id, marc.name)

        // Find Mario Garbo
        const mario = await prisma.user.findFirst({
            where: { name: { contains: 'Mario Garbo', mode: 'insensitive' } }
        })

        if (mario) {
            console.log('Found Mario Garbo:', mario.id, mario.name)
            await prisma.user.update({
                where: { id: mario.id },
                data: { managerId: marc.id }
            })
            console.log('✅ Updated Mario Garbo - set manager to Marc Ramos')
        } else {
            console.log('❌ Mario Garbo not found')
        }

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

fixMarioAssignment()
