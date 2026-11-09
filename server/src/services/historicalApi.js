import { fetchJson } from './http.js';
/**
 * Fetch historical weather data from Open-Meteo Archive API
 * Used to bootstrap ML models with enough training data
 */

import rateLimiter from '../utils/rateLimiter.js';

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

/**
 * Fetch historical weather data for a district
 * @param {Object} district - { id, name, lat, lon }
 * @param {number} days - number of past days to fetch (max 2 years)
 */
export async function fetchHistoricalData(district, days = 90) {
    if (!rateLimiter.canMakeCall()) {
        throw new Error('Rate limit reached');
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (d) => d.toISOString().split('T')[0];

    const params = new URLSearchParams({
        latitude: district.lat,
        longitude: district.lon,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
        daily: [
            'temperature_2m_max', 'temperature_2m_min', 'temperature_2m_mean',
            'precipitation_sum', 'rain_sum', 'weather_code',
            'wind_speed_10m_max', 'relative_humidity_2m_mean',
        ].join(','),
        timezone: 'Asia/Ho_Chi_Minh',
    });

    rateLimiter.recordCall();
    const data = await fetchJson(`${ARCHIVE_URL}?${params}`);
    return parseHistoricalData(data);
}

function parseHistoricalData(data) {
    const daily = data.daily;
    const records = [];

    for (let i = 0; i < daily.time.length; i++) {
        records.push({
            date: daily.time[i],
            temp_max: daily.temperature_2m_max[i],
            temp_min: daily.temperature_2m_min[i],
            temp_mean: daily.temperature_2m_mean[i],
            precipitation: daily.precipitation_sum[i],
            rain: daily.rain_sum[i],
            weather_code: daily.weather_code[i],
            wind_speed_max: daily.wind_speed_10m_max[i],
            humidity_mean: daily.relative_humidity_2m_mean[i],
        });
    }

    return records.filter(r => r.temp_mean != null);
}
