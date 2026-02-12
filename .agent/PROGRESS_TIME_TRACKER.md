# Implementation Progress: Time Tracker & Manager Control

## ✅ Completed Features

### Phase 1: Database Schema (DONE)
- ✅ Added `scheduledStart` and `scheduledEnd` DateTime fields to Attendance model
- ✅ Pushed schema changes to database
- ✅ Regenerated Prisma client

### Phase 2: Scheduled Time Tracker UI (DONE)
- ✅ Added state management for scheduled times in user portal
- ✅ Created collapsible UI section "Set Today's Work Schedule"
- ✅ Added two time inputs for scheduled start/end times
- ✅ Updated `confirmClockIn` function to send scheduled times to API
- ✅ Updated attendance API POST endpoint to accept and store scheduled times
- ✅ Updated attendance API GET endpoint to return scheduled times in transformed records

**User Experience:**
1. When user is clocked out, they see a collapsible section "Set Today's Work Schedule"
2. They can optionally set their planned start and end times
3. When they clock in, these times are saved to the database
4. These times will be used for tardiness calculations

## 🚧 In Progress

### Phase 3: Manager Control Improvements

#### 3.1 View Toggle (Card vs Table) - NEXT
**Location**: `src/app/(user)/user/manager/page.tsx`

**Tasks:**
- [ ] Add view mode state (`card` | `table`)
- [ ] Add toggle buttons in header
- [ ] Create table view component
- [ ] Implement responsive layout switching

#### 3.2 Sidebar Badge Counter - NEXT
**Location**: `src/app/(user)/user/page.tsx`

**Tasks:**
- [ ] Fetch pending request count for manager
- [ ] Add badge to "Manager Control" sidebar item
- [ ] Update count in real-time

### Phase 4: Tardiness Calculation & Display

**Tasks:**
- [ ] Create `calculateTardiness` helper function
- [ ] Add tardiness indicator to user dashboard (when clocked in)
- [ ] Add tardiness column to manager/admin views
- [ ] Add tardiness statistics to performance metrics

## 📝 Implementation Notes

### Scheduled Times Flow:
1. User opens "Set Today's Work Schedule" (optional)
2. Sets start time (e.g., 09:00) and end time (e.g., 17:00)
3. Clicks "Clock In"
4. System saves:
   - `clockIn`: Actual clock-in time
   - `scheduledStart`: Planned start time
   - `scheduledEnd`: Planned end time

### Tardiness Calculation Logic:
```typescript
if (clockIn > scheduledStart) {
  const diffMs = clockIn.getTime() - scheduledStart.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  
  if (diffMinutes > 0) {
    status = "LATE"
    lateBy = `${diffMinutes} min`
  }
} else {
  status = "ON_TIME" or "EARLY"
}
```

## 🎯 Next Steps

1. **Implement Manager Control View Toggle**
   - Add card/table view switching
   - Create compact table layout for pending requests

2. **Add Sidebar Badge Counter**
   - Show pending request count
   - Update in real-time

3. **Add Tardiness Display**
   - Show tardiness indicator in user dashboard
   - Add to manager/admin views
   - Create statistics/reports

## 📂 Files Modified

### Backend:
- ✅ `prisma/schema.prisma` - Added scheduledStart/End fields
- ✅ `src/app/api/attendance/route.ts` - Accept and return scheduled times

### Frontend:
- ✅ `src/app/(user)/user/page.tsx` - Added scheduled time UI and logic

### Pending:
- `src/app/(user)/user/manager/page.tsx` - View toggle & badge
- `src/components/TardinessIndicator.tsx` - New component (optional)
