// NSW (Australia) public holiday calculator
// Handles fixed, Easter-relative, and nth-weekday holidays with weekend substitution rules.

function calculateEaster(year: number): { month: number; day: number } {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
}

function fmt(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
    const d = new Date(Date.UTC(year, month - 1, 1));
    let count = 0;
    while (true) {
        if (d.getUTCDay() === weekday) { if (++count === n) return d.toISOString().slice(0, 10); }
        d.setUTCDate(d.getUTCDate() + 1);
    }
}

// Returns observed weekday for a fixed date (Sun → Mon, Sat stays Sat since weekend check handles it)
function observed(year: number, month: number, day: number): string {
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return dow === 0 ? fmt(year, month, day + 1) : fmt(year, month, day);
}

export function getNSWPublicHolidays(year: number): Set<string> {
    const h = new Set<string>();

    // New Year's Day
    h.add(observed(year, 1, 1));

    // Australia Day
    h.add(observed(year, 1, 26));

    // Easter (Good Friday, Easter Saturday, Easter Sunday, Easter Monday)
    const { month: em, day: ed } = calculateEaster(year);
    const sunday = new Date(Date.UTC(year, em - 1, ed));
    h.add(new Date(Date.UTC(year, em - 1, ed - 2)).toISOString().slice(0, 10)); // Good Friday
    h.add(new Date(Date.UTC(year, em - 1, ed - 1)).toISOString().slice(0, 10)); // Easter Saturday
    h.add(sunday.toISOString().slice(0, 10));                                    // Easter Sunday
    h.add(new Date(Date.UTC(year, em - 1, ed + 1)).toISOString().slice(0, 10)); // Easter Monday

    // ANZAC Day
    h.add(observed(year, 4, 25));

    // King's Birthday — 2nd Monday in June
    h.add(nthWeekdayOfMonth(year, 6, 1, 2));

    // Bank Holiday (NSW) — 1st Monday in August
    h.add(nthWeekdayOfMonth(year, 8, 1, 1));

    // Labour Day (NSW) — 1st Monday in October
    h.add(nthWeekdayOfMonth(year, 10, 1, 1));

    // Christmas / Boxing Day with full substitution logic
    const christmasDow = new Date(Date.UTC(year, 11, 25)).getUTCDay();
    if (christmasDow === 6) {
        // Sat: Christmas → Mon 27, Boxing Day (Sun) → Tue 28
        h.add(fmt(year, 12, 27));
        h.add(fmt(year, 12, 28));
    } else if (christmasDow === 0) {
        // Sun: Boxing Day stays Mon 26, Christmas observed → Tue 27
        h.add(fmt(year, 12, 26));
        h.add(fmt(year, 12, 27));
    } else if (christmasDow === 5) {
        // Fri: Christmas stays Fri 25, Boxing Day (Sat) observed → Mon 28
        h.add(fmt(year, 12, 25));
        h.add(fmt(year, 12, 28));
    } else {
        // Mon–Thu: both fall on weekdays
        h.add(fmt(year, 12, 25));
        h.add(fmt(year, 12, 26));
    }

    return h;
}

export function isNSWPublicHoliday(localDateStr: string): boolean {
    const year = parseInt(localDateStr.slice(0, 4), 10);
    return getNSWPublicHolidays(year).has(localDateStr);
}

export function isAustralianTimezone(tz: string): boolean {
    return tz.startsWith('Australia/');
}
