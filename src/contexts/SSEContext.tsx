'use client'

import { createContext, useContext, useEffect, useRef } from 'react'

export type SSEPayload = { type: string; data?: any; timestamp?: string }
type SSEHandler = (payload: SSEPayload) => void

interface SSEContextValue {
    subscribe: (handler: SSEHandler) => () => void
}

const SSEContext = createContext<SSEContextValue | null>(null)

// Provides a single EventSource per browser tab.
// All child components subscribe to events via useSSE() instead of opening their own connections.
export function SSEProvider({ children, userId }: { children: React.ReactNode; userId?: string }) {
    const listenersRef = useRef<Set<SSEHandler>>(new Set())

    // Stable context value — identity never changes so useSSE's effect only runs once
    const contextValue = useRef<SSEContextValue>({
        subscribe: (handler: SSEHandler) => {
            listenersRef.current.add(handler)
            return () => { listenersRef.current.delete(handler) }
        }
    }).current

    useEffect(() => {
        if (!userId || typeof EventSource === 'undefined') return

        let eventSource: EventSource | null = null
        let closed = false

        const openConnection = () => {
            if (closed) return
            eventSource = new EventSource('/api/stream')
            eventSource.onmessage = (event) => {
                if (event.data === ': heartbeat' || event.data.includes('connected')) return
                try {
                    const payload: SSEPayload = JSON.parse(event.data)
                    listenersRef.current.forEach(h => { try { h(payload) } catch {} })
                } catch {}
            }
            // EventSource auto-reconnects on error — no manual reconnect needed
        }

        openConnection()

        return () => {
            closed = true
            eventSource?.close()
        }
    }, [userId])

    return (
        <SSEContext.Provider value={contextValue}>
            {children}
        </SSEContext.Provider>
    )
}

// Subscribe to SSE events from the nearest SSEProvider.
// The handler is kept current via a ref so subscription never re-runs on re-renders.
export function useSSE(handler: SSEHandler) {
    const ctx = useContext(SSEContext)
    const handlerRef = useRef(handler)

    // Always keep ref pointing at the latest handler (no extra renders)
    handlerRef.current = handler

    // Stable wrapper delegates to the current handler
    const stableHandler = useRef<SSEHandler>((payload) => handlerRef.current(payload)).current

    useEffect(() => {
        if (!ctx) return
        return ctx.subscribe(stableHandler)
    }, [ctx]) // re-subscribe only if the context itself changes
}
