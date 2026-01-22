import { EventEmitter } from 'events';

// Use a global singleton to persist across hot-reloads in development
const globalForEvents = globalThis as unknown as { eventBus: EventEmitter };

export const eventBus = globalForEvents.eventBus || new EventEmitter();

if (process.env.NODE_ENV !== 'production') globalForEvents.eventBus = eventBus;

// Helper to broadcast generic updates
export const broadcastUpdate = (type: 'attendance' | 'leaves' | 'staff' | 'notification', data?: any) => {
    eventBus.emit('update', { type, data, timestamp: new Date().toISOString() });
};
