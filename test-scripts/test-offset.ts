
import fs from 'fs';

const timeZones = [
    'Asia/Manila',
    'Australia/Sydney',
    'America/New_York',
    'UTC',
    'Europe/London'
];

let output = "Testing Offset Logic...\n";

const getOffset = (d: Date, tz: string) => {
    try {
        const format = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
        const parts = format.formatToParts(d);
        const offset = parts.find(p => p.type === 'timeZoneName')?.value; // "GMT+8" or "GMT-05:00"
        return offset ? offset.replace('GMT', '') : 'Z';
    } catch (e) {
        return 'ERROR';
    }
};

const dateStr = "2023-10-27"; // Session Date
const midnightUTC = new Date("2023-10-27T00:00:00Z");

timeZones.forEach(tz => {
    const probe = new Date(midnightUTC);
    probe.setUTCHours(12);

    const offset = getOffset(probe, tz);

    // Construct ISO
    const isoComp = `${dateStr}T23:59:59.999${offset}`;

    let parsed: Date | null = null;
    let isValid = false;
    try {
        parsed = new Date(isoComp);
        if (!isNaN(parsed.getTime())) isValid = true;
    } catch (e) { }

    output += `\nTimezone: ${tz}\n`;
    output += `Offset String Detected: '${offset}'\n`;
    output += `Constructed ISO: '${isoComp}'\n`;
    output += `Parsed UTC: ${isValid && parsed ? parsed.toISOString() : 'INVALID'}\n`;
});

fs.writeFileSync('test-offset-output.txt', output);
