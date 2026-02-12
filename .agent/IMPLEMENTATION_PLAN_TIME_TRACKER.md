# Time Tracker & Manager Control Improvements

## Overview
Implementation plan for adding scheduled work time tracking and improving Manager Control UI.

## Phase 1: Database Schema ✅
- [x] Add `scheduledStart` and `scheduledEnd` DateTime fields to Attendance model
- [x] Run database migration/push
- [x] Regenerate Prisma client

## Phase 2: Scheduled Time Tracker UI
### User Portal Dashboard - Time Tracker Card

**Location**: `src/app/(user)/user/page.tsx`

**Features to Add**:
1. **Scheduled Time Input Section** (above action buttons)
   - Two time inputs: "Scheduled Start" and "Scheduled End"
   - Default to user's shift time (from user.shiftStartTime) or 09:00-17:00
   - Save to database when user clocks in
   - Display in a collapsible section with calendar icon

2. **Tardiness Indicator**
   - Show if user clocked in late (actual clockIn > scheduledStart)
   - Display time difference in red badge
   - Example: "Late by 15 minutes"

3. **Early/On-Time Badge**
   - Green badge if clocked in on time or early
   - Example: "On Time" or "Early by 5 minutes"

**State Management**:
```typescript
const [scheduledStart, setScheduledStart] = useState<string>("")
const [scheduledEnd, setScheduledEnd] = useState<string>("")
const [showScheduleInput, setShowScheduleInput] = useState(false)
```

**API Updates Needed**:
- Update `/api/attendance` POST to accept `scheduledStart` and `scheduledEnd`
- Store these times when creating attendance record

## Phase 3: Manager Control Improvements

### 3.1 View Toggle (Card vs Table)
**Location**: `src/app/(user)/user/manager/page.tsx`

**Implementation**:
1. Add view state: `const [viewMode, setViewMode] = useState<'card' | 'table'>('card')`
2. Add toggle buttons in header (next to search/filters)
3. Create two rendering modes:
   - **Card View** (current): Keep existing card layout
   - **Table View** (new): Compact table with columns:
     - Staff Name
     - Request Type
     - Date/Time
     - Reason (truncated)
     - Actions (Approve/Deny buttons)

**UI Components**:
```tsx
<div className="flex items-center gap-2">
  <Button 
    variant={viewMode === 'card' ? 'default' : 'outline'}
    onClick={() => setViewMode('card')}
  >
    <LayoutGrid className="w-4 h-4" />
  </Button>
  <Button 
    variant={viewMode === 'table' ? 'default' : 'outline'}
    onClick={() => setViewMode('table')}
  >
    <List className="w-4 h-4" />
  </Button>
</div>
```

### 3.2 Sidebar Badge Counter
**Location**: `src/app/(user)/user/page.tsx` (sidebar navigation)

**Implementation**:
1. Fetch pending request count for manager
2. Display badge next to "Manager Control" menu item
3. Update count in real-time when requests are approved/denied

**API Endpoint** (if needed):
- Create `/api/manager/pending-count` or add to existing manager data fetch
- Return: `{ count: number }`

**UI Update**:
```tsx
<div className="flex items-center justify-between">
  <span>Manager Control</span>
  {pendingCount > 0 && (
    <Badge className="bg-red-500 text-white">
      {pendingCount}
    </Badge>
  )}
</div>
```

## Phase 4: Tardiness Calculation Logic

### Admin/Manager Views
**Locations**:
- `src/app/(dashboard)/admin/manager-activity/page.tsx`
- `src/app/(user)/user/manager/page.tsx`

**Features**:
1. **Tardiness Column** in attendance tables
   - Calculate: `actualClockIn - scheduledStart`
   - Display as: "On Time", "15 min late", "30 min early"
   - Color code: Green (on time/early), Yellow (1-15 min), Red (>15 min)

2. **Tardiness Statistics**
   - Add to performance metrics
   - Show average tardiness per employee
   - Highlight chronic late arrivals

**Calculation Helper**:
```typescript
function calculateTardiness(clockIn: Date, scheduledStart: Date) {
  const diff = clockIn.getTime() - scheduledStart.getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes <= 0) return { status: 'on-time', minutes: Math.abs(minutes), label: 'On Time' }
  if (minutes <= 15) return { status: 'slightly-late', minutes, label: `${minutes} min late` }
  return { status: 'late', minutes, label: `${minutes} min late` }
}
```

## Implementation Order

1. ✅ Database schema update
2. **Next**: Add scheduled time inputs to user dashboard
3. Update attendance API to save scheduled times
4. Add tardiness display in user dashboard
5. Implement Manager Control view toggle
6. Add sidebar badge counter
7. Add tardiness calculations to manager/admin views
8. Test end-to-end workflow

## Files to Modify

### Core Files:
- `src/app/(user)/user/page.tsx` - Add scheduled time inputs
- `src/app/api/attendance/route.ts` - Save scheduled times
- `src/app/(user)/user/manager/page.tsx` - View toggle & badge
- `src/app/(dashboard)/admin/manager-activity/page.tsx` - Tardiness display

### UI Components (if needed):
- Create `src/components/TardinessIndicator.tsx`
- Create `src/components/ScheduleTimeInput.tsx`

## Testing Checklist

- [ ] User can set scheduled start/end times
- [ ] Times are saved to database
- [ ] Tardiness is calculated correctly
- [ ] Manager Control shows card and table views
- [ ] Sidebar badge shows correct count
- [ ] Badge updates when requests are processed
- [ ] Tardiness appears in admin reports
- [ ] All timezones handled correctly
