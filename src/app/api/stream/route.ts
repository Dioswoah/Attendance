import { NextRequest, NextResponse } from 'next/server';
import { eventBus } from '@/lib/eventBus';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();

    // Create a streaming response
    const stream = new ReadableStream({
        start(controller) {
            // Helper to send SSE formatted data
            const sendEvent = (data: any) => {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            };

            // Send initial connection confirmation
            sendEvent({ type: 'connected', message: 'SSE Stream Connected' });

            // Listener function
            const onUpdate = (data: any) => {
                sendEvent(data);
            };

            // Subscribe to the event bus
            eventBus.on('update', onUpdate);

            // Keep the connection alive with a heartbeat every 30s
            // (prevents timeouts on some hosting platforms)
            const heartbeat = setInterval(() => {
                controller.enqueue(encoder.encode(': heartbeat\n\n'));
            }, 30000);

            // Cleanup when the connection closes
            req.signal.addEventListener('abort', () => {
                eventBus.off('update', onUpdate);
                clearInterval(heartbeat);
                controller.close();
            });
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
