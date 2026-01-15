// Attendance data structure
export interface AttendanceRecord {
  id: string
  userId: string
  userName: string
  department: string
  date: string
  clockIn: string
  clockOut?: string
  mode: string
  status: 'clocked-in' | 'clocked-out' | 'on-break'
  breakStart?: string
  breakEnd?: string
}

// Get all attendance records
export function getAttendanceRecords(): AttendanceRecord[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem('attendanceRecords')
  return data ? JSON.parse(data) : []
}

// Save attendance records
export function saveAttendanceRecords(records: AttendanceRecord[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem('attendanceRecords', JSON.stringify(records))
}

// Get today's attendance for a specific user
export function getTodayAttendance(userId: string): AttendanceRecord | null {
  const records = getAttendanceRecords()
  const today = new Date().toISOString().split('T')[0]
  return records.find(r => r.userId === userId && r.date === today) || null
}

// Clock in
export function clockIn(userId: string, userName: string, department: string, mode: string): AttendanceRecord {
  const records = getAttendanceRecords()
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()
  
  const existing = records.find(r => r.userId === userId && r.date === today)
  if (existing) {
    return existing
  }
  
  const newRecord: AttendanceRecord = {
    id: `${userId}-${Date.now()}`,
    userId,
    userName,
    department,
    date: today,
    clockIn: now,
    mode,
    status: 'clocked-in'
  }
  
  records.push(newRecord)
  saveAttendanceRecords(records)
  return newRecord
}

// Clock out
export function clockOut(userId: string): AttendanceRecord | null {
  const records = getAttendanceRecords()
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()
  
  const record = records.find(r => r.userId === userId && r.date === today)
  if (record) {
    record.clockOut = now
    record.status = 'clocked-out'
    saveAttendanceRecords(records)
    return record
  }
  
  return null
}

// Start break
export function startBreak(userId: string): AttendanceRecord | null {
  const records = getAttendanceRecords()
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()
  
  const record = records.find(r => r.userId === userId && r.date === today)
  if (record) {
    record.breakStart = now
    record.status = 'on-break'
    saveAttendanceRecords(records)
    return record
  }
  
  return null
}

// End break
export function endBreak(userId: string): AttendanceRecord | null {
  const records = getAttendanceRecords()
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()
  
  const record = records.find(r => r.userId === userId && r.date === today)
  if (record) {
    record.breakEnd = now
    record.status = 'clocked-in'
    saveAttendanceRecords(records)
    return record
  }
  
  return null
}
