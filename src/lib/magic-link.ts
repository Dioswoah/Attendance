import crypto from 'crypto';

const SECRET = process.env.NEXTAUTH_SECRET || 'fallback_secret_key_change_me';

export type MagicAction = 'clock-in' | 'clock-out' | 'end-break';

export function generateMagicLink(userId: string, action: MagicAction): string {
    const timestamp = Date.now().toString();
    const data = `${userId}:${action}:${timestamp}`;
    const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');

    const baseUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';
    return `${baseUrl}/api/magic/action?userId=${userId}&action=${action}&ts=${timestamp}&sig=${signature}`;
}

export function verifyMagicLink(userId: string, action: string, timestamp: string, signature: string): boolean {
    const data = `${userId}:${action}:${timestamp}`;
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('hex');

    // Constant time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return false;

    // Check expiry (24 hours)
    const age = Date.now() - parseInt(timestamp);
    // 24 hours in ms
    if (age > 24 * 60 * 60 * 1000) return false;

    return true;
}
