# Performance Metrics Computation with Individual Work Hours

## 🎯 Overview

Now that each user has their own work hours (`shiftStartTime`, `shiftEndTime`), we need to compute performance metrics **relative to each individual's schedule** rather than using a fixed schedule for everyone.

## 📊 Metrics to Compute

### 1. Tardiness (Late Arrivals)
**Definition**: Minutes late relative to scheduled start time

**Computation**:
```typescript
function calculateTardiness(attendance: Attendance, user: User): number {
    // Use attendance-specific scheduled time if available, otherwise use user's default
    const expectedStart = attendance.scheduledStart || user.shiftStartTime
    const actualStart = attendance.clockIn
    
    if (!actualStart || !expectedStart) return 0
    
    // Convert time strings to minutes since midnight
    const expectedMinutes = timeToMinutes(expectedStart)
    const actualMinutes = timeToMinutes(new Date(actualStart))
    
    const difference = actualMinutes - expectedMinutes
    
    // Only count as tardiness if positive (late)
    return Math.max(0, difference)
}

function timeToMinutes(time: string | Date): number {
    if (time instanceof Date) {
        return time.getHours() * 60 + time.getMinutes()
    }
    // time is "HH:MM" format
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
}
```

**Example**:
- User A: Expected 09:00, Actual 09:15 → **15 minutes late**
- User B: Expected 08:00, Actual 08:10 → **10 minutes late**
- User C: Expected 09:00, Actual 08:55 → **0 minutes late** (early)

### 2. Early Departures
**Definition**: Minutes left before scheduled end time

**Computation**:
```typescript
function calculateEarlyDeparture(attendance: Attendance, user: User): number {
    const expectedEnd = attendance.scheduledEnd || user.shiftEndTime
    const actualEnd = attendance.clockOut
    
    if (!actualEnd || !expectedEnd) return 0
    
    const expectedMinutes = timeToMinutes(expectedEnd)
    const actualMinutes = timeToMinutes(new Date(actualEnd))
    
    const difference = expectedMinutes - actualMinutes
    
    // Only count as early departure if positive (left early)
    return Math.max(0, difference)
}
```

**Example**:
- User A: Expected 17:00, Actual 16:45 → **15 minutes early**
- User B: Expected 18:00, Actual 18:05 → **0 minutes early** (stayed late)

### 3. Punctuality Rate
**Definition**: Percentage of days arrived on-time (within grace period)

**Computation**:
```typescript
function calculatePunctualityRate(
    attendanceRecords: Attendance[], 
    user: User,
    gracePeriodMinutes: number = 5
): number {
    if (attendanceRecords.length === 0) return 100
    
    const onTimeDays = attendanceRecords.filter(record => {
        const tardiness = calculateTardiness(record, user)
        return tardiness <= gracePeriodMinutes
    }).length
    
    return Math.round((onTimeDays / attendanceRecords.length) * 100)
}
```

**Example**:
- 20 days total, 18 days on-time (within 5 min grace) → **90% punctuality**

### 4. Total Hours Worked vs Expected
**Definition**: Actual hours worked compared to scheduled hours

**Computation**:
```typescript
function calculateHoursMetrics(attendance: Attendance, user: User) {
    const clockIn = new Date(attendance.clockIn)
    const clockOut = new Date(attendance.clockOut)
    
    // Calculate actual hours worked (excluding breaks)
    const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60)
    const breakMinutes = attendance.breakDuration || 0
    const actualHoursWorked = (totalMinutes - breakMinutes) / 60
    
    // Calculate expected hours
    const expectedStart = attendance.scheduledStart || user.shiftStartTime
    const expectedEnd = attendance.scheduledEnd || user.shiftEndTime
    const expectedMinutes = timeToMinutes(expectedEnd) - timeToMinutes(expectedStart)
    const expectedHours = expectedMinutes / 60
    
    return {
        actualHours: actualHoursWorked,
        expectedHours: expectedHours,
        variance: actualHoursWorked - expectedHours
    }
}
```

**Example**:
- User A: Expected 8 hours, Worked 7.5 hours → **-0.5 hours variance**
- User B: Expected 9 hours, Worked 9.5 hours → **+0.5 hours variance**

### 5. Missed Shifts
**Definition**: Days where user was expected to work but didn't clock in

**Computation**:
```typescript
function calculateMissedShifts(
    dateRange: { start: Date, end: Date },
    attendanceRecords: Attendance[],
    user: User
): number {
    // Get all working days in range (exclude weekends/holidays)
    const workingDays = getWorkingDays(dateRange.start, dateRange.end)
    
    // Count days with no attendance record
    const missedDays = workingDays.filter(day => {
        return !attendanceRecords.some(record => 
            isSameDay(new Date(record.clockIn), day)
        )
    })
    
    return missedDays.length
}
```

## 🔄 Aggregation for Department/Team Performance

### Department-Level Metrics:
```typescript
function calculateDepartmentMetrics(
    department: Department,
    dateRange: { start: Date, end: Date }
) {
    const users = getUsersInDepartment(department.id)
    const allAttendance = getAttendanceForUsers(users, dateRange)
    
    // Calculate individual metrics for each user
    const userMetrics = users.map(user => {
        const userAttendance = allAttendance.filter(a => a.userId === user.id)
        
        return {
            userId: user.id,
            userName: user.name,
            punctualityRate: calculatePunctualityRate(userAttendance, user),
            avgTardiness: calculateAvgTardiness(userAttendance, user),
            avgEarlyDeparture: calculateAvgEarlyDeparture(userAttendance, user),
            totalHoursWorked: calculateTotalHours(userAttendance, user),
            missedShifts: calculateMissedShifts(dateRange, userAttendance, user)
        }
    })
    
    // Aggregate for department
    return {
        avgPunctualityRate: average(userMetrics.map(m => m.punctualityRate)),
        avgTardiness: average(userMetrics.map(m => m.avgTardiness)),
        totalMissedShifts: sum(userMetrics.map(m => m.missedShifts)),
        userMetrics: userMetrics // Individual breakdown
    }
}
```

## 📈 Performance View Display

### Individual Staff Card:
```
┌─────────────────────────────────────────┐
│ Christopher Pinca                       │
│ Team Member                             │
│ Work Hours: 09:00 - 17:00              │
├─────────────────────────────────────────┤
│ Punctuality:        95% ✓              │
│ Avg Tardiness:      3 min              │
│ Early Departures:   2 days             │
│ Hours Worked:       160h / 160h        │
│ Missed Shifts:      0                  │
└─────────────────────────────────────────┘
```

### Department Summary:
```
┌─────────────────────────────────────────┐
│ Engineering Department                  │
│ 15 Staff Members                        │
├─────────────────────────────────────────┤
│ Avg Punctuality:    91% ✓              │
│ Avg Tardiness:      7 min              │
│ Total Missed Shifts: 3                 │
│ On-Time Rate:       88%                │
└─────────────────────────────────────────┘
```

## 🎨 Visual Indicators

### Color Coding:
```typescript
function getPunctualityColor(rate: number): string {
    if (rate >= 95) return 'text-green-600'  // Excellent
    if (rate >= 85) return 'text-blue-600'   // Good
    if (rate >= 75) return 'text-yellow-600' // Fair
    return 'text-red-600'                     // Needs Improvement
}

function getTardinessColor(avgMinutes: number): string {
    if (avgMinutes <= 5) return 'text-green-600'  // Excellent
    if (avgMinutes <= 15) return 'text-yellow-600' // Fair
    return 'text-red-600'                           // Needs Improvement
}
```

## 🔍 Handling Edge Cases

### 1. User Changed Work Hours Mid-Period
**Solution**: Use `scheduledStart/End` from attendance record if available
```typescript
// Attendance record stores the scheduled times for that specific day
const expectedStart = attendance.scheduledStart || user.shiftStartTime
```

### 2. User Has No Default Work Hours Set
**Solution**: Use system default or skip metrics
```typescript
if (!user.shiftStartTime || !user.shiftEndTime) {
    return {
        punctualityRate: null,
        avgTardiness: null,
        message: "Work hours not set"
    }
}
```

### 3. Part-Time vs Full-Time Staff
**Solution**: Calculate metrics relative to their own schedule
```typescript
// Part-time: 09:00-13:00 (4 hours)
// Full-time: 09:00-17:00 (8 hours)
// Both measured against their own expected hours
```

### 4. Flexible/Variable Schedules
**Solution**: Rely on `scheduledStart/End` in attendance record
```typescript
// User sets different hours each day
// Day 1: 08:00-16:00
// Day 2: 10:00-18:00
// Each day measured against its own scheduled times
```

## 📊 Database Queries

### Fetch User with Work Hours:
```typescript
const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
        id: true,
        name: true,
        shiftStartTime: true,
        shiftEndTime: true,
        department: true
    }
})
```

### Fetch Attendance with Scheduled Times:
```typescript
const attendance = await prisma.attendance.findMany({
    where: {
        userId: userId,
        clockIn: {
            gte: startDate,
            lte: endDate
        }
    },
    select: {
        id: true,
        clockIn: true,
        clockOut: true,
        scheduledStart: true,
        scheduledEnd: true,
        breakDuration: true
    }
})
```

## 🚀 Implementation Steps

### Phase 1: Helper Functions
1. Create `calculateTardiness()`
2. Create `calculateEarlyDeparture()`
3. Create `calculatePunctualityRate()`
4. Create `calculateHoursMetrics()`

### Phase 2: API Endpoint
1. Create `/api/performance/user/[id]` - Individual metrics
2. Create `/api/performance/department/[id]` - Department metrics
3. Include date range filtering

### Phase 3: UI Updates
1. Update Performance tab in Manager Control
2. Add individual staff cards with metrics
3. Add department summary
4. Add charts/graphs for trends

### Phase 4: Reports
1. Update Excel export to include:
   - Individual work hours
   - Tardiness calculations
   - Punctuality rates
   - Flags for changed work hours

## 📝 Example API Response

```json
{
  "userId": "user123",
  "userName": "Christopher Pinca",
  "workHours": {
    "start": "09:00",
    "end": "17:00"
  },
  "period": {
    "start": "2026-02-05",
    "end": "2026-02-12"
  },
  "metrics": {
    "punctualityRate": 95,
    "avgTardiness": 3,
    "avgEarlyDeparture": 0,
    "totalHoursWorked": 40,
    "expectedHours": 40,
    "hoursVariance": 0,
    "missedShifts": 0,
    "onTimeDays": 19,
    "lateDays": 1,
    "totalDays": 20
  },
  "dailyBreakdown": [
    {
      "date": "2026-02-05",
      "scheduledStart": "09:00",
      "scheduledEnd": "17:00",
      "actualStart": "09:05",
      "actualEnd": "17:00",
      "tardiness": 5,
      "earlyDeparture": 0,
      "hoursWorked": 8
    }
  ]
}
```

## 🎯 Key Principles

1. **Individual-Relative**: All metrics calculated relative to each user's own schedule
2. **Flexible**: Supports different work hours per user
3. **Accurate**: Uses scheduled times from attendance record when available
4. **Transparent**: Shows both expected and actual values
5. **Fair**: Doesn't penalize users with different schedules
6. **Auditable**: Change log tracks when work hours were modified

This approach ensures fair and accurate performance tracking regardless of each user's individual work schedule!
