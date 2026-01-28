import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSchema() {
    console.log('Checking Cloud SQL Database Schema...')
    try {
        // Try to access the ChatSession table
        const count = await prisma.chatSession.count()
        console.log(`✅ Table 'ChatSession' exists. Count: ${count}`)

        // Try to access the ChatMessage table
        const msgCount = await prisma.chatMessage.count()
        console.log(`✅ Table 'ChatMessage' exists. Count: ${msgCount}`)

    } catch (error: any) {
        console.error('❌ Schema Check Failed!')
        console.error('It seems the Cloud SQL database is missing some tables.')
        console.error(`Error Code: ${error.code}`)
        console.error(`Message: ${error.message}`)
    } finally {
        await prisma.$disconnect()
    }
}

checkSchema()
