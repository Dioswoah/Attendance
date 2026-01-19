/**
 * Force Session Refresh
 * This deletes all sessions from the database to force users to re-authenticate
 * Run with: npx tsx force-refresh-sessions.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function forceRefreshSessions() {
    console.log('🔄 Force refreshing all sessions...\n')

    try {
        // Delete all sessions
        const result = await prisma.session.deleteMany({})

        console.log(`✅ Deleted ${result.count} session(s)`)
        console.log('\n📋 Next steps:')
        console.log('   1. Refresh your browser')
        console.log('   2. You will be redirected to sign in')
        console.log('   3. Sign in with Google')
        console.log('   4. Your roles will be loaded fresh from the database')
        console.log('   5. Manager Control will appear if you have ADMIN/MANAGER role!')

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

forceRefreshSessions()
