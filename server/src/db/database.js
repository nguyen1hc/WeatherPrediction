import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

export function initDatabase() {
    const dbPath = join(__dirname, '..', '..', 'data', 'weather.db');
    db = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run schema
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    db.exec(schema);

    console.log('✅ Database initialized at', dbPath);
    return db;
}

export function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

// --- Location management ---

export function addLocation(location) {
    const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO user_locations (id, name, display_name, lat, lon, country, country_code, admin1, admin2, timezone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    return stmt.run(
        location.id, location.name, location.display_name || location.name,
        location.lat, location.lon,
        location.country || '', location.country_code || '',
        location.admin1 || '', location.admin2 || '',
        location.timezone || 'Asia/Ho_Chi_Minh'
    );
}

export function removeLocation(locationId) {
    return getDb().prepare('UPDATE user_locations SET is_active = 0 WHERE id = ?').run(locationId);
}

export function deleteLocation(locationId) {
    getDb().prepare('DELETE FROM weather_current WHERE district_id = ?').run(locationId);
    getDb().prepare('DELETE FROM weather_forecast WHERE district_id = ?').run(locationId);
    getDb().prepare('DELETE FROM weather_hourly WHERE district_id = ?').run(locationId);
    return getDb().prepare('DELETE FROM user_locations WHERE id = ?').run(locationId);
}

export function getLocation(locationId) {
    return getDb().prepare('SELECT * FROM user_locations WHERE id = ?').get(locationId);
}

export function getAllLocations() {
    return getDb().prepare('SELECT * FROM user_locations ORDER BY created_at DESC').all();
}

export function getActiveLocations() {
    return getDb().prepare('SELECT * FROM user_locations WHERE is_active = 1 ORDER BY created_at DESC').all();
}

export function addLocationByCoords(lat, lon, name) {
    const id = `custom-${lat.toFixed(4)}-${lon.toFixed(4)}`;
    return addLocation({
        id, name: name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        display_name: name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        lat, lon,
    });
}

// --- Insert operations ---

export function insertCurrentWeather(districtId, data) {
    const stmt = getDb().prepare(`
    INSERT INTO weather_current (
      district_id, temperature, feels_like, humidity, precipitation,
      rain, weather_code, wind_speed, wind_direction, pressure, uv_index, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    return stmt.run(
        districtId,
        data.temperature,
        data.feels_like,
        data.humidity,
        data.precipitation,
        data.rain,
        data.weather_code,
        data.wind_speed,
        data.wind_direction,
        data.pressure,
        data.uv_index,
        data.time || new Date().toISOString()
    );
}

export function insertDailyForecast(districtId, forecasts) {
    const stmt = getDb().prepare(`
    INSERT INTO weather_forecast (
      district_id, forecast_date, temp_max, temp_min,
      precipitation_sum, rain_sum, weather_code, uv_index_max
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const insertMany = getDb().transaction((items) => {
        for (const f of items) {
            stmt.run(
                districtId, f.date, f.temp_max, f.temp_min,
                f.precipitation_sum, f.rain_sum, f.weather_code, f.uv_index_max
            );
        }
    });

    insertMany(forecasts);
}

export function insertHourlyForecast(districtId, hourlyData) {
    const stmt = getDb().prepare(`
    INSERT INTO weather_hourly (
      district_id, forecast_time, temperature, humidity,
      precipitation_probability, rain, weather_code, wind_speed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const insertMany = getDb().transaction((items) => {
        for (const h of items) {
            stmt.run(
                districtId, h.time, h.temperature, h.humidity,
                h.precipitation_probability, h.rain, h.weather_code, h.wind_speed
            );
        }
    });

    insertMany(hourlyData);
}

// --- Query operations ---

export function getLatestWeather(districtId) {
    return getDb().prepare(`
    SELECT * FROM weather_current
    WHERE district_id = ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `).get(districtId);
}

export function getAllLatestWeather() {
    return getDb().prepare(`
    SELECT wc.* FROM weather_current wc
    INNER JOIN (
      SELECT district_id, MAX(recorded_at) as max_time
      FROM weather_current
      GROUP BY district_id
    ) latest ON wc.district_id = latest.district_id AND wc.recorded_at = latest.max_time
    ORDER BY wc.district_id
  `).all();
}

export function getWeatherHistory(districtId, hours = 24) {
    return getDb().prepare(`
    SELECT * FROM weather_current
    WHERE district_id = ?
      AND recorded_at >= datetime('now', ?)
    ORDER BY recorded_at ASC
  `).all(districtId, `-${hours} hours`);
}

export function getDailyForecast(districtId) {
    return getDb().prepare(`
    SELECT * FROM weather_forecast
    WHERE district_id = ?
      AND forecast_date >= date('now')
    ORDER BY forecast_date ASC
  `).all(districtId);
}

export function getHourlyForecast(districtId, hours = 48) {
    return getDb().prepare(`
    SELECT * FROM weather_hourly
    WHERE district_id = ?
      AND forecast_time >= datetime('now')
      AND forecast_time <= datetime('now', ?)
    ORDER BY forecast_time ASC
  `).all(districtId, `+${hours} hours`);
}

export function getLatestFetchLog() {
    return getDb().prepare(`
    SELECT * FROM fetch_log ORDER BY created_at DESC LIMIT 10
  `).all();
}

export function insertFetchLog(districtsFetched, successCount, errorCount, durationMs) {
    return getDb().prepare(`
    INSERT INTO fetch_log (districts_fetched, success_count, error_count, duration_ms)
    VALUES (?, ?, ?, ?)
  `).run(districtsFetched, successCount, errorCount, durationMs);
}

export function getRecordCount() {
    const current = getDb().prepare('SELECT COUNT(*) as count FROM weather_current').get();
    const forecast = getDb().prepare('SELECT COUNT(*) as count FROM weather_forecast').get();
    const hourly = getDb().prepare('SELECT COUNT(*) as count FROM weather_hourly').get();
    return {
        current: current.count,
        forecast: forecast.count,
        hourly: hourly.count,
    };
}

// Clean up old data (keep last 30 days)
export function cleanOldData() {
    const result = getDb().prepare(`
    DELETE FROM weather_current WHERE recorded_at < datetime('now', '-30 days')
  `).run();
    const result2 = getDb().prepare(`
    DELETE FROM weather_hourly WHERE fetched_at < datetime('now', '-7 days')
  `).run();
    console.log(`🧹 Cleaned ${result.changes + result2.changes} old records`);
}
