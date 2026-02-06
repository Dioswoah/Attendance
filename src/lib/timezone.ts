/**
 * Timezone Utility Library
 * 
 * Best practices for handling time in a multi-timezone environment:
 * 1. ALWAYS store times in UTC in the database
 * 2. Convert to local timezone only for display
 * 3. Use IANA timezone identifiers (e.g., "Australia/Sydney", "Asia/Manila")
 */

export interface TimezoneInfo {
    value: string
    label: string
    offset: string
    region: string
}

/**
 * Comprehensive list of timezones organized by region
 * Focuses on Sydney, Melbourne, and Manila as primary locations
 */
export const TIMEZONES: TimezoneInfo[] = [
    // Primary Office Locations
    { value: "Australia/Sydney", label: "Sydney (AEDT/AEST)", offset: "+11:00/+10:00", region: "Primary Offices" },
    { value: "Australia/Melbourne", label: "Melbourne (AEDT/AEST)", offset: "+11:00/+10:00", region: "Primary Offices" },
    { value: "Asia/Manila", label: "Manila (PHT)", offset: "+08:00", region: "Primary Offices" },

    // Other Australian Timezones
    { value: "Australia/Brisbane", label: "Brisbane (AEST)", offset: "+10:00", region: "Australia" },
    { value: "Australia/Perth", label: "Perth (AWST)", offset: "+08:00", region: "Australia" },
    { value: "Australia/Adelaide", label: "Adelaide (ACDT/ACST)", offset: "+10:30/+09:30", region: "Australia" },
    { value: "Australia/Darwin", label: "Darwin (ACST)", offset: "+09:30", region: "Australia" },
    { value: "Australia/Hobart", label: "Hobart (AEDT/AEST)", offset: "+11:00/+10:00", region: "Australia" },

    // Asia Pacific
    { value: "Asia/Singapore", label: "Singapore (SGT)", offset: "+08:00", region: "Asia Pacific" },
    { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)", offset: "+08:00", region: "Asia Pacific" },
    { value: "Asia/Tokyo", label: "Tokyo (JST)", offset: "+09:00", region: "Asia Pacific" },
    { value: "Asia/Seoul", label: "Seoul (KST)", offset: "+09:00", region: "Asia Pacific" },
    { value: "Asia/Shanghai", label: "Shanghai (CST)", offset: "+08:00", region: "Asia Pacific" },
    { value: "Asia/Bangkok", label: "Bangkok (ICT)", offset: "+07:00", region: "Asia Pacific" },
    { value: "Asia/Kuala_Lumpur", label: "Kuala Lumpur (MYT)", offset: "+08:00", region: "Asia Pacific" },
    { value: "Asia/Jakarta", label: "Jakarta (WIB)", offset: "+07:00", region: "Asia Pacific" },
    { value: "Pacific/Auckland", label: "Auckland (NZDT/NZST)", offset: "+13:00/+12:00", region: "Asia Pacific" },

    // Americas
    { value: "America/New_York", label: "New York (EST/EDT)", offset: "-05:00/-04:00", region: "Americas" },
    { value: "America/Chicago", label: "Chicago (CST/CDT)", offset: "-06:00/-05:00", region: "Americas" },
    { value: "America/Denver", label: "Denver (MST/MDT)", offset: "-07:00/-06:00", region: "Americas" },
    { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)", offset: "-08:00/-07:00", region: "Americas" },
    { value: "America/Toronto", label: "Toronto (EST/EDT)", offset: "-05:00/-04:00", region: "Americas" },
    { value: "America/Vancouver", label: "Vancouver (PST/PDT)", offset: "-08:00/-07:00", region: "Americas" },

    // Europe
    { value: "Europe/London", label: "London (GMT/BST)", offset: "+00:00/+01:00", region: "Europe" },
    { value: "Europe/Paris", label: "Paris (CET/CEST)", offset: "+01:00/+02:00", region: "Europe" },
    { value: "Europe/Berlin", label: "Berlin (CET/CEST)", offset: "+01:00/+02:00", region: "Europe" },
    { value: "Europe/Amsterdam", label: "Amsterdam (CET/CEST)", offset: "+01:00/+02:00", region: "Europe" },
    { value: "Europe/Zurich", label: "Zurich (CET/CEST)", offset: "+01:00/+02:00", region: "Europe" },

    // UTC
    { value: "UTC", label: "UTC (Coordinated Universal Time)", offset: "+00:00", region: "Universal" },
]

/**
 * Get the user's browser timezone
 */
export function getBrowserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch (error) {
        console.error("Failed to detect browser timezone:", error)
        return "UTC"
    }
}

/**
 * Convert a UTC date to a specific timezone
 * @param utcDate - Date object in UTC
 * @param timezone - IANA timezone identifier
 * @returns Formatted date string in the target timezone
 */
export function convertToTimezone(
    utcDate: Date | string,
    timezone: string,
    options?: Intl.DateTimeFormatOptions
): string {
    try {
        const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate

        const defaultOptions: Intl.DateTimeFormatOptions = {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            ...options
        }

        return new Intl.DateTimeFormat('en-AU', defaultOptions).format(date)
    } catch (error) {
        console.error("Failed to convert timezone:", error)
        return new Date(utcDate).toISOString()
    }
}

/**
 * Format a date for display with timezone abbreviation
 * @param utcDate - Date object in UTC
 * @param timezone - IANA timezone identifier
 * @returns Formatted string with timezone abbreviation
 */
export function formatWithTimezone(
    utcDate: Date | string,
    timezone: string,
    format: 'full' | 'date' | 'time' | 'datetime' = 'datetime'
): string {
    try {
        const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate

        let options: Intl.DateTimeFormatOptions = {
            timeZone: timezone,
            timeZoneName: 'short'
        }

        switch (format) {
            case 'full':
                options = {
                    ...options,
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }
                break
            case 'date':
                options = {
                    ...options,
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }
                break
            case 'time':
                options = {
                    ...options,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }
                break
            case 'datetime':
            default:
                options = {
                    ...options,
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }
                break
        }

        return new Intl.DateTimeFormat('en-AU', options).format(date)
    } catch (error) {
        console.error("Failed to format with timezone:", error)
        return new Date(utcDate).toISOString()
    }
}

/**
 * Get the current offset for a timezone (handles DST automatically)
 * @param timezone - IANA timezone identifier
 * @returns Offset string (e.g., "+11:00", "-05:00")
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): string {
    try {
        const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
        const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
        const offset = (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60)

        const sign = offset >= 0 ? '+' : '-'
        const hours = Math.floor(Math.abs(offset))
        const minutes = Math.round((Math.abs(offset) - hours) * 60)

        return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    } catch (error) {
        console.error("Failed to get timezone offset:", error)
        return "+00:00"
    }
}

/**
 * Calculate duration between two UTC timestamps
 * Safe from DST transitions
 * @param startUtc - Start time in UTC
 * @param endUtc - End time in UTC
 * @returns Duration object with hours, minutes, seconds
 */
export function calculateDuration(
    startUtc: Date | string,
    endUtc: Date | string
): { hours: number; minutes: number; seconds: number; totalMs: number } {
    const start = typeof startUtc === 'string' ? new Date(startUtc) : startUtc
    const end = typeof endUtc === 'string' ? new Date(endUtc) : endUtc

    const totalMs = end.getTime() - start.getTime()

    if (totalMs < 0) {
        return { hours: 0, minutes: 0, seconds: 0, totalMs: 0 }
    }

    const hours = Math.floor(totalMs / (1000 * 60 * 60))
    const minutes = Math.floor((totalMs / (1000 * 60)) % 60)
    const seconds = Math.floor((totalMs / 1000) % 60)

    return { hours, minutes, seconds, totalMs }
}

/**
 * Format duration for display
 */
export function formatDuration(duration: { hours: number; minutes: number; seconds: number }): string {
    return `${duration.hours}h ${duration.minutes}m ${duration.seconds}s`
}

/**
 * Get timezone info by value
 */
export function getTimezoneInfo(timezone: string): TimezoneInfo | undefined {
    return TIMEZONES.find(tz => tz.value === timezone)
}

/**
 * Group timezones by region
 */
export function getTimezonesByRegion(): Record<string, TimezoneInfo[]> {
    return TIMEZONES.reduce((acc, tz) => {
        if (!acc[tz.region]) {
            acc[tz.region] = []
        }
        acc[tz.region].push(tz)
        return acc
    }, {} as Record<string, TimezoneInfo[]>)
}

/**
 * Convert local time to UTC for storage
 * @param localDate - Date in local timezone
 * @param timezone - IANA timezone identifier
 * @returns UTC Date object
 */
export function convertToUTC(localDate: Date, timezone: string): Date {
    try {
        // Get the date string in the specified timezone
        const dateStr = localDate.toLocaleString('en-US', { timeZone: timezone })
        // Parse it as if it were UTC
        const utcDate = new Date(dateStr + ' UTC')
        return utcDate
    } catch (error) {
        console.error("Failed to convert to UTC:", error)
        return localDate
    }
}

/**
 * Export data with timezone information for CSV
 * Includes UTC time, timezone offset, and adjusted time
 */
export interface ExportTimeData {
    utcTime: string
    timezoneOffset: string
    adjustedTime: string
    timezone: string
}

export function prepareTimeForExport(
    utcDate: Date | string,
    timezone: string
): ExportTimeData {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate

    return {
        utcTime: date.toISOString(),
        timezoneOffset: getTimezoneOffset(timezone, date),
        adjustedTime: formatWithTimezone(date, timezone, 'datetime'),
        timezone: timezone
    }
}
