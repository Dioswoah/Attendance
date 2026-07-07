// AU payroll runs Thursday -> Wednesday (paid on Wednesdays).
// The "current" period is whichever Thu-Wed block contains the reference date.
export function getCurrentAuPayrollPeriod(reference: Date = new Date()) {
    const day = reference.getDay() // 0=Sun..6=Sat, Thu=4
    const diffFromThursday = (day - 4 + 7) % 7

    const start = new Date(reference)
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - diffFromThursday)

    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    return { start, end }
}
