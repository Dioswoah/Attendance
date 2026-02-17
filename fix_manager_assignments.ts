import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixManagerAssignments() {
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

        console.log('✅ Found Marc Ramos:', marc.id, marc.name, marc.email)

        // Find Chris Wyborn
        const chris = await prisma.user.findFirst({
            where: { name: { contains: 'Chris Wyborn', mode: 'insensitive' } }
        })

        // Find Christopher Pinca
        const christopher = await prisma.user.findFirst({
            where: { name: { contains: 'Christopher Pinca', mode: 'insensitive' } }
        })

        console.log('Chris Wyborn:', chris ? `${chris.id} - ${chris.name}` : 'NOT FOUND')
        console.log('Christopher Pinca:', christopher ? `${christopher.id} - ${christopher.name}` : 'NOT FOUND')

        // Update Chris Wyborn's manager
        if (chris) {
            await prisma.user.update({
                where: { id: chris.id },
                data: { managerId: marc.id }
            })
            console.log('✅ Updated Chris Wyborn - set manager to Marc Ramos')
        }

        // Update Christopher Pinca's manager
        if (christopher) {
            await prisma.user.update({
                where: { id: christopher.id },
                data: { managerId: marc.id }
            })
            console.log('✅ Updated Christopher Pinca - set manager to Marc Ramos')
        }

        // Find Fire Industry Academy department
        const fireDept = await prisma.department.findFirst({
            where: { name: { contains: 'Fire Industry Academy', mode: 'insensitive' } }
        })

        // Find Business Growth Team department
        const businessDept = await prisma.department.findFirst({
            where: { name: { contains: 'Business Growth', mode: 'insensitive' } }
        })

        console.log('Fire Industry Academy:', fireDept ? `${fireDept.id} - ${fireDept.name}` : 'NOT FOUND')
        console.log('Business Growth Team:', businessDept ? `${businessDept.id} - ${businessDept.name}` : 'NOT FOUND')

        // Set Marc as manager of Fire Industry Academy
        if (fireDept) {
            await prisma.department.update({
                where: { id: fireDept.id },
                data: { managerId: marc.id }
            })
            console.log('✅ Set Marc as manager of Fire Industry Academy')
        }

        // Set Marc as manager of Business Growth Team
        if (businessDept) {
            await prisma.department.update({
                where: { id: businessDept.id },
                data: { managerId: marc.id }
            })
            console.log('✅ Set Marc as manager of Business Growth Team')
        }

        console.log('\n✅ All updates completed successfully!')

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

fixManagerAssignments()
