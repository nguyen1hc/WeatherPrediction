import test from 'node:test';
import assert from 'node:assert/strict';
import { initDatabase, getDb, insertHourlyForecast, getHourlyForecast, storeWeather } from '../src/db/database.js';
import { fetchWeatherForDistrict } from '../src/services/weatherApi.js';

const HOUR = 60 * 60 * 1000;
const district = { id: 'hourly-test', name: 'Test', lat: 10, lon: 106 };

function openDatabase(t) {
    process.env.DB_PATH = ':memory:';
    initDatabase();
    t.after(() => getDb().close());
}

function upstreamResponse(length = 168) {
    // Open-Meteo returns local times starting at midnight, with the UTC offset separately.
    const start = Date.parse('2026-11-10T00:00:00Z');
    const times = Array.from({ length }, (_, i) => new Date(start + i * HOUR).toISOString().slice(0, 16));
    return {
        utc_offset_seconds: 7 * 60 * 60,
        current: { time: '2026-11-10T00:00', temperature_2m: 30 },
        hourly: Object.fromEntries([
            ['time', times],
            ...['temperature_2m', 'relative_humidity_2m', 'precipitation_probability', 'rain', 'weather_code', 'wind_speed_10m']
                .map(key => [key, times.map((_, i) => i)]),
        ]),
        daily: { time: [] },
    };
}

test('hourly query filters actual instants and supports legacy Vietnam times and explicit offsets', t => {
    openDatabase(t);
    const now = new Date('2026-11-10T11:15:00Z'); // 18:15 in Vietnam
    insertHourlyForecast(district.id, [
        { time: '2026-11-10T18:00', temperature: -1 }, // Past, despite sorting after the UTC bound as text.
        { time: '2026-11-10T19:00', temperature: 1 },
        { time: '2026-11-10 20:00:00', temperature: 2 },
        { time: '2026-11-10T14:00:00Z', temperature: 3 },
        { time: '2026-11-10T10:00:00-05:00', temperature: 4 },
        { time: '2026-11-10T23:00:00+07:00', temperature: 5 },
        { time: '2026-11-12T18:15', temperature: 99 }, // Exactly 48 hours away: outside the half-open window.
        { time: '2026-11-12T19:00', temperature: 100 },
        { time: 'invalid', temperature: 101 },
    ]);

    const rows = getHourlyForecast(district.id, 48, now);
    assert.deepEqual(rows.map(row => row.temperature), [1, 2, 3, 4, 5]);
    assert.deepEqual(rows.map(row => row.forecast_time), [
        '2026-11-10T12:00:00Z', '2026-11-10T13:00:00Z', '2026-11-10T14:00:00Z',
        '2026-11-10T15:00:00Z', '2026-11-10T16:00:00Z',
    ]);
    assert.equal(getHourlyForecast(district.id, 1, now).length, 1);
});

test('hourly query handles the UTC/Vietnam date boundary', t => {
    openDatabase(t);
    insertHourlyForecast(district.id, [
        { time: '2026-11-11T04:00', temperature: -1 },
        { time: '2026-11-11T05:00', temperature: 1 },
        { time: '2026-11-11T06:00:00+07:00', temperature: 2 },
    ]);
    const rows = getHourlyForecast(district.id, 2, new Date('2026-11-10T21:30:00Z'));
    assert.deepEqual(rows.map(row => row.temperature), [1, 2]);
    assert.equal(rows[0].forecast_time, '2026-11-10T22:00:00Z');
});

for (const localTime of ['00:00', '18:00', '18:15', '23:45']) {
    test(`ingestion through SQLite returns the next 48 hourly points at ${localTime} Vietnam time`, async t => {
        openDatabase(t);
        const now = new Date(`2026-11-10T${localTime}:00+07:00`);
        t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
        t.mock.method(globalThis, 'fetch', async () => Response.json(upstreamResponse()));
        const data = await fetchWeatherForDistrict(district);
        assert.equal(data.hourly.length, 48);
        storeWeather(district.id, data);

        const rows = getHourlyForecast(district.id);
        assert.equal(rows.length, 48);
        const firstHour = Math.ceil(now.getTime() / HOUR) * HOUR;
        for (const [i, row] of rows.entries()) {
            const timestamp = Date.parse(row.forecast_time);
            assert.equal(timestamp, firstHour + i * HOUR);
            assert.ok(timestamp >= now.getTime() && timestamp < now.getTime() + 48 * HOUR);
            // Verify values stay aligned with the selected hourly timestamps.
            assert.equal(row.temperature, Math.ceil(Number(localTime.slice(0, 2)) + Number(localTime.slice(3)) / 60) + i);
        }
    });
}

test('a short upstream forecast returns only available future hours', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-10T18:15:00+07:00') });
    t.mock.method(globalThis, 'fetch', async () => Response.json(upstreamResponse(24)));
    const data = await fetchWeatherForDistrict(district);
    assert.equal(data.hourly.length, 5);
    assert.deepEqual(data.hourly.map(row => row.temperature), [19, 20, 21, 22, 23]);
});
