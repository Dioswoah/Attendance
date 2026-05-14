export const actionLock = { current: false }

export function setActionLock(value: boolean) {
    actionLock.current = value
    if (typeof window !== 'undefined') {
        // Store on window so layout (separate JS chunk) reads the same value
        ;(window as any).__attendanceActionLocked = value
        window.dispatchEvent(new CustomEvent('attendance-action-lock', { detail: { locked: value } }))
    }
}

export function isActionLocked(): boolean {
    if (typeof window !== 'undefined') {
        return (window as any).__attendanceActionLocked === true
    }
    return actionLock.current
}
