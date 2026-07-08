// A fetch that never hangs forever. A plain fetch() promise can go unresolved
// indefinitely if the connection stalls (mobile backgrounding, flaky network,
// a slow backend) — any caller gating a UI lock on that promise settling would
// stay locked forever. This guarantees the promise rejects with an AbortError
// after timeoutMs so callers can always recover.
export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(input, { ...init, signal: controller.signal })
    } finally {
        clearTimeout(timeoutId)
    }
}
