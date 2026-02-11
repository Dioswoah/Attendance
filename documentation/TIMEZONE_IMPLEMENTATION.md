# Timezone Management Implementation

## Overview

This document explains the comprehensive timezone management system implemented in the Redadair Staff Availability application. The system follows industry best practices for handling time in multi-timezone environments with offices in Sydney, Melbourne, and Manila.

## Core Principles

### 1. **Store in UTC, Display in Local**
- **All timestamps are stored in UTC** in the database
- Times are converted to the user's preferred timezone **only for display**
- This ensures data integrity and prevents DST-related bugs

### 2. **IANA Timezone Identifiers**
- Uses standard IANA timezone names (e.g., `Australia/Sydney`, `Asia/Manila`)
- Automatically handles Daylight Saving Time (DST) transitions
- More reliable than hardcoded offsets which change with DST

### 3. **User Preferences**
- Users can choose to use their browser's timezone (automatic detection)
- Or manually select a specific timezone from a comprehensive list
- Preferences are saved per user and persist across sessions

## Database Schema

### User Model Extensions

```prisma
model User {
  // ... existing fields ...
  useCurrentTimezone Boolean  @default(true)
  selectedTimezone   String?  @default("UTC")
}
```

- **useCurrentTimezone**: Boolean flag indicating if the user wants to use browser-detected timezone
- **selectedTimezone**: The manually selected timezone (used when useCurrentTimezone is false)

## Architecture

### 1. Timezone Utility Library (`src/lib/timezone.ts`)

Provides comprehensive timezone handling functions:

#### Key Functions:

- **`getBrowserTimezone()`**: Detects the user's browser timezone
- **`convertToTimezone()`**: Converts UTC date to a specific timezone
- **`formatWithTimezone()`**: Formats dates with timezone abbreviations
- **`getTimezoneOffset()`**: Gets current offset (handles DST automatically)
- **`calculateDuration()`**: Calculates duration between UTC timestamps (DST-safe)
- **`prepareTimeForExport()`**: Prepares time data for CSV export with full timezone info

#### Timezone List:

The library includes 30+ timezones organized by region:
- **Primary Offices**: Sydney, Melbourne, Manila
- **Australia**: All major cities
- **Asia Pacific**: Singapore, Hong Kong, Tokyo, etc.
- **Americas**: Major US/Canadian cities
- **Europe**: Major European cities
- **Universal**: UTC

### 2. User Portal Components

#### TimezoneSettings Component (`src/components/TimezoneSettings.tsx`)

A comprehensive settings dialog that allows users to:
- Toggle between browser timezone and manual selection
- Select from a categorized list of timezones
- See live preview of current time in selected timezone
- View current timezone offset

**Features:**
- Real-time clock display
- Visual feedback with timezone offset
- Grouped timezone selection by region
- Clear explanatory text about UTC storage

**Usage:**
```tsx
<TimezoneSettings />           // Full button with label
<TimezoneSettings compact />   // Icon-only button
```

### 3. Admin Portal Components

#### AdminTimezoneSelect Component (`src/components/AdminTimezoneSelect.tsx`)

A specialized timezone selector for admin reports:
- Required timezone selection for all exports
- Shows current offset dynamically
- Includes explanatory text about export format

**Usage:**
```tsx
<AdminTimezoneSelect 
  value={reportTimezone}
  onChange={setReportTimezone}
  label="Report Timezone"
/>
```

### 4. API Endpoints

#### `/api/user/timezone` (PATCH, GET)

Manages user timezone preferences:

**PATCH Request:**
```json
{
  "useCurrentTimezone": true,
  "selectedTimezone": "Australia/Sydney"
}
```

**Response:**
```json
{
  "id": "user_id",
  "useCurrentTimezone": true,
  "selectedTimezone": "Australia/Sydney"
}
```

## Implementation in Portals

### User Portal

**Location**: Desktop header (between Admin Portal button and Onboarding Tour)

```tsx
<TimezoneSettings />
```

**Features:**
- Always accessible from the header
- Settings persist across sessions
- Automatically updates session after changes

### Admin Portal

**Location**: Header (compact icon button)

```tsx
<TimezoneSettings compact />
```

**Reports Page**: Required timezone selection for exports

```tsx
<AdminTimezoneSelect 
  value={reportTimezone}
  onChange={setReportTimezone}
/>
```

## Export Functionality

### CSV Export with Timezone Data

When exporting attendance reports, the system includes:

1. **UTC Time**: The original timestamp stored in the database
2. **Timezone Offset**: The offset at that specific moment (e.g., "+11:00")
3. **Adjusted Time**: The time in the selected timezone
4. **Timezone Name**: The IANA timezone identifier

**Example CSV Output:**

| Employee | Clock In (UTC) | Clock In (TZ Offset) | Clock In (Adjusted) | Report Timezone |
|----------|----------------|---------------------|---------------------|-----------------|
| John Doe | 2024-01-15T22:00:00Z | +11:00 | 09:00 AEDT | Australia/Sydney |

This allows users to:
- Verify the original UTC data
- Understand the timezone conversion applied
- Manipulate the data in Excel/Sheets if needed
- Ensure audit compliance

## Session Management

Timezone preferences are included in the user session:

```typescript
// In auth.ts session callback
(session.user as any).useCurrentTimezone = dbUser.useCurrentTimezone ?? true;
(session.user as any).selectedTimezone = dbUser.selectedTimezone || "UTC";
```

This ensures:
- Preferences are immediately available after login
- No additional API calls needed for timezone info
- Consistent timezone display across the app

## Best Practices Followed

### 1. **UTC Storage**
✅ All database timestamps are in UTC
✅ No timezone-specific data in the database
✅ Prevents DST-related calculation errors

### 2. **Client-Side Conversion**
✅ Conversion happens only at display time
✅ Uses browser's Intl API for accurate formatting
✅ Respects user's locale preferences

### 3. **DST Handling**
✅ Automatic DST transitions
✅ No manual offset calculations
✅ Uses IANA timezone database

### 4. **Audit Trail**
✅ Export includes UTC + offset + adjusted time
✅ Full transparency in reports
✅ Users can verify conversions

### 5. **User Experience**
✅ Simple toggle between auto and manual
✅ Live preview of current time
✅ Clear explanations of how it works
✅ Persistent preferences

## Usage Examples

### For Developers

#### Converting a UTC timestamp for display:

```typescript
import { formatWithTimezone } from '@/lib/timezone';

const utcTimestamp = new Date('2024-01-15T22:00:00Z');
const userTimezone = 'Australia/Sydney';

const displayTime = formatWithTimezone(utcTimestamp, userTimezone, 'datetime');
// Output: "16 Jan 2024, 09:00 AEDT"
```

#### Calculating duration (DST-safe):

```typescript
import { calculateDuration, formatDuration } from '@/lib/timezone';

const clockIn = new Date('2024-01-15T22:00:00Z');
const clockOut = new Date('2024-01-16T06:00:00Z');

const duration = calculateDuration(clockIn, clockOut);
const formatted = formatDuration(duration);
// Output: "8h 0m 0s"
```

#### Preparing data for export:

```typescript
import { prepareTimeForExport } from '@/lib/timezone';

const timestamp = new Date('2024-01-15T22:00:00Z');
const timezone = 'Australia/Sydney';

const exportData = prepareTimeForExport(timestamp, timezone);
// Returns:
// {
//   utcTime: "2024-01-15T22:00:00.000Z",
//   timezoneOffset: "+11:00",
//   adjustedTime: "16 Jan 2024, 09:00 AEDT",
//   timezone: "Australia/Sydney"
// }
```

### For Users

#### Setting Timezone Preferences:

1. Click the **Globe icon** in the header
2. Choose between:
   - **Use My Current Timezone**: Automatic detection
   - **Select a Specific Timezone**: Manual selection
3. If manual, select from the categorized list
4. Click **Save Settings**

#### Generating Reports with Timezone:

1. Navigate to **Admin Portal → Export Ledger**
2. Set date range and filters
3. **Select Report Timezone** (required)
4. Click **Generate Master Ledger**
5. Excel file includes UTC, offset, and adjusted times

## Migration

The database migration adds two new fields to the User table:

```sql
ALTER TABLE "User" 
ADD COLUMN "useCurrentTimezone" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "selectedTimezone" TEXT DEFAULT 'UTC';
```

**Migration Name**: `add_timezone_preferences`

## Testing Recommendations

### Test Cases:

1. **Browser Timezone Detection**
   - Verify correct detection across different browsers
   - Test with VPN/location changes

2. **Manual Timezone Selection**
   - Test all primary office timezones
   - Verify offset calculations

3. **DST Transitions**
   - Test dates before/after DST changes
   - Verify automatic offset adjustments

4. **Export Functionality**
   - Verify all three time columns in CSV
   - Test with different timezone selections
   - Verify data integrity

5. **Session Persistence**
   - Verify settings persist after logout/login
   - Test session updates after preference changes

## Troubleshooting

### Common Issues:

**Issue**: Times showing incorrectly
- **Solution**: Check if user's browser timezone is correct
- **Solution**: Verify selected timezone matches expected location

**Issue**: DST offset wrong
- **Solution**: Ensure using IANA timezone names, not hardcoded offsets
- **Solution**: Check if browser's timezone database is up to date

**Issue**: Export times don't match display
- **Solution**: Verify report timezone selection
- **Solution**: Check UTC column in export for source of truth

## Future Enhancements

Potential improvements:
- [ ] Timezone-aware calendar views
- [ ] Automatic timezone detection based on IP geolocation
- [ ] Team timezone visibility (see when colleagues are online)
- [ ] Timezone conversion tooltips on hover
- [ ] Historical timezone data for past DST transitions

## References

- [IANA Time Zone Database](https://www.iana.org/time-zones)
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [ISO 8601 Date Format](https://en.wikipedia.org/wiki/ISO_8601)
- [Daylight Saving Time](https://en.wikipedia.org/wiki/Daylight_saving_time)

## Support

For questions or issues related to timezone functionality:
1. Check this documentation
2. Review the timezone utility library code
3. Test with UTC timestamps to verify data integrity
4. Contact the development team if issues persist
