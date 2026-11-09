import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { freshness } from '../src/services/freshness.js';
import { fetchJson } from '../src/services/http.js';

// Keep tests independent from the checked-in database and the public API.
process.env.DB_PATH = ':memory:';
const { initDatabase, getDb, addLocation, storeWeather, getAllLatestWeather } = await import('../src/db/database.js');

test('freshness handles UTC SQLite dates, mixed ages, missing and invalid timestamps', () => {
    const now = Date.parse('2026-11-08T12:00:00Z');
    assert.equal(freshness([], now).state, 'missing');
    assert.equal(freshness([{ fetched_at: '2026-11-08 11:45:00' }], now).state, 'fresh');
    const result = freshness([{ fetched_at: '2026-11-08 11:00:00' }, { fetched_at: '2026-11-08 11:59:00' }], now);
    assert.equal(result.state, 'stale');
    assert.equal(result.staleCount, 1);
    assert.equal(result.lastUpdated, '2026-11-08T11:00:00.000Z');
    assert.equal(freshness([{ fetched_at: 'bad' }], now).state, 'stale');
});

test('HTTP retries transient errors but rejects permanent errors immediately', async () => {
    let calls = 0;
    const data = await fetchJson('https://example.com', {
        fetchImpl: async () => ++calls < 3 ? new Response('', { status: 503 }) : Response.json({ ok: true }),
        wait: async () => {},
    });
    assert.deepEqual(data, { ok: true });
    assert.equal(calls, 3);
    calls = 0;
    await assert.rejects(fetchJson('https://example.com', {
        fetchImpl: async () => { calls++; return new Response('', { status: 403 }); },
        wait: async () => {},
    }), /403/);
    assert.equal(calls, 1);
});

test('HTTP timeouts are bounded and network retries are capped', async () => {
    let calls = 0;
    await assert.rejects(fetchJson('https://example.com', {
        fetchImpl: async () => { calls++; throw new Error('network down'); },
        wait: async () => {},
    }), /network down/);
    assert.equal(calls, 3);
    const keepAlive = setInterval(() => {}, 100);
    try {
        await assert.rejects(fetchJson('https://example.com', {
            retries: 0, timeoutMs: 10,
            fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            }),
        }), { name: 'TimeoutError' });
    } finally { clearInterval(keepAlive); }
});

test('weather storage rolls back failures and returns one latest reading per active location', () => {
    initDatabase();
    addLocation({ id: 'test', name: 'Test', lat: 10, lon: 106 });
    const reading = {
        current: { temperature: 30, time: '2026-11-08T12:00' },
        daily: [{ date: '2026-11-09', temp_max: 32 }],
        hourly: [{ time: '2026-11-08T13:00', temperature: 31 }],
    };
    storeWeather('test', reading);
    storeWeather('test', reading);
    assert.equal(getAllLatestWeather().length, 1);
    assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM weather_forecast').get().n, 1);
    assert.throws(() => storeWeather('test', { ...reading, hourly: [null] }));
    assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM weather_current').get().n, 2);
    assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM weather_forecast').get().n, 1);
    getDb().prepare('UPDATE user_locations SET is_active = 0').run();
    assert.equal(getAllLatestWeather().length, 0);
    getDb().close();
});

test('real server serves isolated SQLite and reports missing data as degraded', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'weather-test-'));
    const child = spawn(process.execPath, ['src/index.js'], {
        cwd: new URL('..', import.meta.url),
        env: { ...process.env, DB_PATH: join(directory, 'weather.db'), PORT: '0', DISABLE_SCHEDULER: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    try {
        const deadline = Date.now() + 10000;
        while (!output.includes('running at') && Date.now() < deadline && child.exitCode === null) {
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        const port = output.match(/localhost:(\d+)/)?.[1];
        assert.ok(port && port !== '0', output);
        for (const path of ['/api/locations', '/api/weather/current', '/api/status']) {
            const response = await fetch(`http://127.0.0.1:${port}${path}`);
            assert.equal(response.status, 200);
            const data = await response.json();
            if (path.endsWith('current')) assert.equal(data.freshness.state, 'missing');
            if (path.endsWith('status')) assert.equal(data.status, 'degraded');
            if (path.endsWith('locations')) assert.equal(data.count, 0);
        }
    } finally {
        if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
        await rm(directory, { recursive: true, force: true });
    }
});
