import { google } from 'googleapis';

/**
 * Google Calendar Working Location Service
 * Syncs user availability status with Google Calendar working location events
 */

export type WorkingLocationType = 'officeLocation' | 'homeOffice' | 'customLocation';

export interface WorkingLocationEvent {
    id?: string;
    summary: string;
    description?: string;
    start: {
        dateTime: string;
        timeZone: string;
    };
    end: {
        dateTime: string;
        timeZone: string;
    };
    eventType: 'workingLocation';
    workingLocationProperties: {
        type: WorkingLocationType;
        customLocation?: {
            label: string;
        };
        homeOffice?: object;
        officeLocation?: {
            label: string;
        };
    };
    visibility: 'public';
    transparency: 'transparent';
}

/**
 * Map app availability status to Google Calendar working location
 */
export function mapStatusToWorkingLocation(
    status: string,
    workMode: string = 'OFFICE',
    customMessage?: string
): { type: WorkingLocationType; label: string; summary: string } {
    // If custom message is provided, prioritize it as a custom location
    if (customMessage && customMessage.trim() !== '') {
        return {
            type: 'customLocation',
            label: customMessage,
            summary: `💼 ${customMessage}`,
        };
    }

    // Map based on status and work mode
    if (status === 'AVAILABLE' || status === 'BUSY') {
        if (workMode === 'WFH') {
            return {
                type: 'homeOffice',
                label: 'Working from Home',
                summary: '🏠 Working from Home',
            };
        } else if (workMode === 'OFFICE') {
            return {
                type: 'officeLocation',
                label: 'In Office',
                summary: '🏢 In Office',
            };
        } else {
            return {
                type: 'customLocation',
                label: 'Working',
                summary: '💼 Working',
            };
        }
    } else if (status === 'BE_RIGHT_BACK') {
        return {
            type: 'customLocation',
            label: 'On Break',
            summary: '☕ On Break',
        };
    } else if (status === 'DO_NOT_DISTURB') {
        return {
            type: 'customLocation',
            label: 'In a Meeting',
            summary: '📅 In a Meeting',
        };
    }

    // Default: offline/away
    return {
        type: 'customLocation',
        label: 'Offline',
        summary: '⚫ Offline',
    };
}

/**
 * Map Google Calendar working location to app availability status
 */
export function mapWorkingLocationToStatus(location: any): { status: string; customMessage?: string } {
    if (!location) return { status: 'AVAILABLE' }; // Default if nothing found (or maybe keep existing? assuming Available usually)

    const type = location.type;
    const props = location.workingLocationProperties || {};

    // 1. Check for Custom Location (could be Status or Message)
    if (type === 'customLocation') {
        const label = props.customLocation?.label || '';

        if (label === 'On Break') return { status: 'BE_RIGHT_BACK' };
        if (label === 'In a Meeting' || label === 'Do Not Disturb') return { status: 'DO_NOT_DISTURB' };
        if (label === 'Offline') return { status: 'APPEAR_OFFLINE' };
        if (label === 'Working') return { status: 'AVAILABLE' }; // Generic working

        // If it's none of the above specific ones, treat it as a Custom Message on "AVAILABLE" (or whatever fits)
        return { status: 'AVAILABLE', customMessage: label };
    }

    // 2. Home Office -> WFH (Available)
    if (type === 'homeOffice') {
        return { status: 'AVAILABLE' }; // We don't change status based on WFH, just mode. Here we care about status.
    }

    // 3. Office -> Office (Available)
    if (type === 'officeLocation') {
        return { status: 'AVAILABLE' };
    }

    return { status: 'AVAILABLE' };
}

/**
 * Create or update working location event in Google Calendar
 */
export async function setWorkingLocation(
    accessToken: string,
    status: string,
    workMode: string,
    startTime: Date,
    endTime: Date,
    timezone: string = 'UTC',
    customMessage?: string
): Promise<string | null> {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.AUTH_GOOGLE_ID,
            process.env.AUTH_GOOGLE_SECRET
        );

        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const location = mapStatusToWorkingLocation(status, workMode, customMessage);

        // Build working location properties based on type
        const workingLocationProperties: any = {
            type: location.type,
        };

        if (location.type === 'homeOffice') {
            workingLocationProperties.homeOffice = {};
        } else if (location.type === 'officeLocation') {
            workingLocationProperties.officeLocation = {
                label: location.label,
            };
        } else {
            workingLocationProperties.customLocation = {
                label: location.label,
            };
        }

        const event: any = {
            summary: location.summary,

            start: {
                dateTime: startTime.toISOString(),
                timeZone: timezone,
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: timezone,
            },
            eventType: 'workingLocation',
            workingLocationProperties,
            visibility: 'public',
            transparency: 'transparent',
        };

        // Check if there's already a working location event for today
        const existingEvent = await findTodayWorkingLocation(accessToken, timezone);

        if (existingEvent) {
            // Update existing event
            const result = await calendar.events.update({
                calendarId: 'primary',
                eventId: existingEvent.id!,
                requestBody: event,
            });

            console.log('[Calendar Service] Updated working location:', result.data.id);
            return result.data.id || null;
        } else {
            // Create new event
            const result = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
            });

            console.log('[Calendar Service] Created working location:', result.data.id);
            return result.data.id || null;
        }
    } catch (error) {
        console.error('[Calendar Service] Failed to set working location:', error);
        return null;
    }
}

// ... findTodayWorkingLocation ...
// ... removeWorkingLocation ...
// ... getCurrentWorkingLocation ...

/**
 * Sync app status to Google Calendar
 * Called when user changes status in the app
 */
export async function syncStatusToCalendar(
    accessToken: string,
    status: string,
    workMode: string,
    timezone: string = 'UTC',
    customMessage?: string
): Promise<boolean> {
    try {
        // If status is BE_RIGHT_BACK, do NOT sync to Google (User request: App ONLY)
        if (status === 'BE_RIGHT_BACK') {
            console.log('[Calendar Service] Skipping sync for BE_RIGHT_BACK (App only status)');
            return true;
        }

        // Don't sync if user is offline/away and no custom message
        if ((status === 'APPEAR_OFFLINE' || status === 'APPEAR_AWAY') && !customMessage) {
            return await removeWorkingLocation(accessToken, timezone);
        }

        // Set working hours (current time to end of work day - 6 PM)
        const now = new Date();
        const endOfWorkDay = new Date(now);
        endOfWorkDay.setHours(18, 0, 0, 0);

        // If it's already past 6 PM, set end time to 11:59 PM
        if (now >= endOfWorkDay) {
            endOfWorkDay.setHours(23, 59, 59, 999);
        }

        const eventId = await setWorkingLocation(
            accessToken,
            status,
            workMode,
            now,
            endOfWorkDay,
            timezone,
            customMessage
        );

        return eventId !== null;
    } catch (error) {
        console.error('[Calendar Service] Failed to sync status to calendar:', error);
        return false;
    }
}

/**
 * Find today's working location event
 */
export async function findTodayWorkingLocation(
    accessToken: string,
    timezone: string = 'UTC'
): Promise<any | null> {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.AUTH_GOOGLE_ID,
            process.env.AUTH_GOOGLE_SECRET
        );

        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Get start and end of today in the user's timezone
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        // Find working location events
        const workingLocationEvents = response.data.items?.filter(
            (event: any) => event.eventType === 'workingLocation'
        );

        if (workingLocationEvents && workingLocationEvents.length > 0) {
            return workingLocationEvents[0];
        }

        return null;
    } catch (error) {
        console.error('[Calendar Service] Failed to find working location:', error);
        return null;
    }
}

/**
 * Remove working location event (when user clocks out)
 */
export async function removeWorkingLocation(
    accessToken: string,
    timezone: string = 'UTC'
): Promise<boolean> {
    try {
        const existingEvent = await findTodayWorkingLocation(accessToken, timezone);

        if (!existingEvent) {
            console.log('[Calendar Service] No working location to remove');
            return true;
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.AUTH_GOOGLE_ID,
            process.env.AUTH_GOOGLE_SECRET
        );

        oauth2Client.setCredentials({ access_token: accessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        await calendar.events.delete({
            calendarId: 'primary',
            eventId: existingEvent.id!,
        });

        console.log('[Calendar Service] Removed working location:', existingEvent.id);
        return true;
    } catch (error) {
        console.error('[Calendar Service] Failed to remove working location:', error);
        return false;
    }
}

/**
 * Get current working location from Google Calendar
 */
/**
 * Get current working location from Google Calendar
 * Now also checks for "Blocking" events (Opaque/Focus/OOO) to infer status
 */
export async function getCurrentWorkingLocation(
    accessToken: string,
    timezone: string = 'UTC'
): Promise<{
    type: WorkingLocationType | null;
    label: string | null;
    summary: string | null;
} | null> {
    try {
        // 1. Check for specific Working Location (Office/Home/Custom)
        // This is still the "source of truth" for location.
        const workLocEvent = await findTodayWorkingLocation(accessToken, timezone);

        if (workLocEvent && workLocEvent.workingLocationProperties) {
            const props = workLocEvent.workingLocationProperties;
            const type = props.type as WorkingLocationType;
            let label = null;
            if (type === 'homeOffice') {
                label = 'Working from Home';
            } else if (type === 'officeLocation' && props.officeLocation?.label) {
                label = props.officeLocation.label;
            } else if (type === 'customLocation' && props.customLocation?.label) {
                label = props.customLocation.label;
            }
            return {
                type,
                label,
                summary: workLocEvent.summary || null,
            };
        }

        // 2. Fallback: Check for ACTIVE blocking events (Focus Time, Out of Office, Busy Meetings)
        // If we can't find a location, maybe the user is "Do Not Disturb" because of a meeting?
        const oauth2Client = new google.auth.OAuth2(
            process.env.AUTH_GOOGLE_ID,
            process.env.AUTH_GOOGLE_SECRET
        );
        oauth2Client.setCredentials({ access_token: accessToken });
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const now = new Date();
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: now.toISOString(),
            // Look ahead 5 minutes to safely catch current events
            timeMax: new Date(now.getTime() + 5 * 60000).toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            showDeleted: false,
        });

        const activeEvents = response.data.items || [];

        // Priority Checks:
        // A. Out of Office -> Offline
        const oooEvent = activeEvents.find(e => e.eventType === 'outOfOffice');
        if (oooEvent) {
            return {
                type: 'customLocation',
                label: 'Offline',
                summary: 'Out of Office'
            };
        }

        // B. Focus Time -> Do Not Disturb
        const focusEvent = activeEvents.find(e => e.eventType === 'focusTime');
        if (focusEvent) {
            return {
                type: 'customLocation',
                label: 'In a Meeting',
                summary: 'Focus Time'
            };
        }

        // C. Google Meet / Video Call -> In a Meeting
        const meetEvent = activeEvents.find((e: any) => e.hangoutLink || e.conferenceData);
        if (meetEvent) {
            return {
                type: 'customLocation',
                label: 'In a Meeting',
                summary: 'On going'
            };
        }

        // D. Busy Event (opaque) -> Do Not Disturb
        // Use the first "Busy" event that is NOT transparent
        const busyEvent = activeEvents.find((e: any) => e.transparency !== 'transparent');
        if (busyEvent) {
            return {
                type: 'customLocation',
                label: 'In a Meeting',
                summary: 'On going'
            };
        }

        return null; // Available / Nothing Special
    } catch (error) {
        console.error('[Calendar Service] Failed to get working location:', error);
        return null;
    }
}


