
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        const allUsers = await prisma.user.findMany();
        console.log("All Users:", allUsers.map(u => ({ name: u.name, email: u.email, id: u.id })));

        const targetUser = allUsers.find(u => u.name?.includes("Marc"));

        if (!targetUser) {
            console.log("No users found in database!")
            return
        }

        console.log(`Found user: ${targetUser.name} (${targetUser.email}) ID: ${targetUser.id}`)

        // Check for existing attendance today
        const now = new Date()
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

        console.log("Checking attendance for date:", today.toISOString())

        const existing = await prisma.attendance.findFirst({
            where: {
                userId: targetUser.id,
                date: today,
                clockOut: null
            }
        })

        if (existing) {
            console.log("Active session found:", existing)
        } else {
            console.log("No active session found. Ready to clock in.")
        }

        // Attempt simulated API call (mimicking what the frontend does)
        console.log("Simulating API POST to http://localhost:3000/api/attendance...")

        const response = await fetch('http://localhost:3000/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: targetUser.id,
                mode: 'OFFICE',
                // frontend sends 'date' sometimes, let's see current behavior in page.tsx
                // page.tsx doesn't seem to send 'date' explicitly in confirmClockIn, just userId and mode.
            })
        })

        const result = await response.json()
        console.log("API Response Status:", response.status)
        console.log("API Response Body:", JSON.stringify(result, null, 2))

    } catch (e) {
        console.error("Debug script error:", e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
