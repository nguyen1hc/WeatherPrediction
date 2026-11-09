const MAX_AGE_MS = 30 * 60 * 1000;

export function freshness(rows, now = Date.now()) {
    const times = rows.map(row => {
        // SQLite CURRENT_TIMESTAMP is UTC without an explicit offset.
        const value = row.fetched_at;
        return value ? Date.parse(value.includes('T') ? value : value.replace(' ', 'T') + 'Z') : NaN;
    });
    const valid = times.filter(Number.isFinite);
    const staleCount = times.filter(time => !Number.isFinite(time) || now - time > MAX_AGE_MS).length;
    return {
        state: !rows.length ? 'missing' : staleCount ? 'stale' : 'fresh',
        staleCount,
        lastUpdated: valid.length ? new Date(Math.min(...valid)).toISOString() : null,
        maxAgeMinutes: MAX_AGE_MS / 60000,
    };
}
