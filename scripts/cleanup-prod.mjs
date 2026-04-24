// One-time production cleanup script — removes test data before go-live.
// Run via Cloud Run Job. KEEP: users, departments, teams, system settings.
// CLEAR: attendance, leaves, requests, notifications, activity logs, chats.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

async function main() {
  console.log('=== Production Cleanup Starting ===')

  // Chat (messages cascade from sessions)
  const chatMessages = await prisma.chatMessage.deleteMany()
  console.log(`Deleted ${chatMessages.count} chat messages`)

  const chatSessions = await prisma.chatSession.deleteMany()
  console.log(`Deleted ${chatSessions.count} chat sessions`)

  // Audit / logs
  const activityLogs = await prisma.activityLog.deleteMany()
  console.log(`Deleted ${activityLogs.count} activity logs`)

  const workHoursLogs = await prisma.workHoursChangeLog.deleteMany()
  console.log(`Deleted ${workHoursLogs.count} work hours change logs`)

  // Notifications
  const notifications = await prisma.notification.deleteMany()
  console.log(`Deleted ${notifications.count} notifications`)

  // Amendment requests
  const amendRequests = await prisma.attendanceRequest.deleteMany()
  console.log(`Deleted ${amendRequests.count} amendment requests`)

  // Leave requests and approved leaves
  const leaveRequests = await prisma.leaveRequest.deleteMany()
  console.log(`Deleted ${leaveRequests.count} leave requests`)

  const leaves = await prisma.leave.deleteMany()
  console.log(`Deleted ${leaves.count} leave records`)

  // Attendance — Break cascades automatically via onDelete: Cascade
  const attendance = await prisma.attendance.deleteMany()
  console.log(`Deleted ${attendance.count} attendance records (breaks cascade)`)

  // Summaries — safe to delete now that Attendance rows are gone
  const summaries = await prisma.attendanceSummary.deleteMany()
  console.log(`Deleted ${summaries.count} attendance summaries`)

  // Reset user live-state so nobody appears clocked-in from test data
  const usersReset = await prisma.user.updateMany({
    data: {
      availabilityStatus: 'AVAILABLE',
      customStatusMessage: null,
      forceLogoutAt: null,
    },
  })
  console.log(`Reset availability status for ${usersReset.count} users`)

  console.log('=== Production Cleanup Complete ===')
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
