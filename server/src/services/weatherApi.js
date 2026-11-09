import { fetchJson } from './http.js';
/**
 * Open-Meteo API client for fetching weather data
 * Free API - no key required
 */

import rateLimiter from '../utils/rateLimiter.js';
import { weatherTimeToUtc } from '../utils/weatherTime.js';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// WMO Weather interpretation codes → descriptions
const WEATHER_CODES = {
    0: 'Trời quang',
    1: 'Gần như quang',
    2: 'Có mây rải rác',
    3: 'Nhiều mây',
    45: 'Sương mù',
    48: 'Sương mù muối',
    51: 'Mưa phùn nhẹ',
    53: 'Mưa phùn',
    55: 'Mưa phùn dày',
    56: 'Mưa phùn đóng băng nhẹ',
    57: 'Mưa phùn đóng băng',
    61: 'Mưa nhẹ',
    63: 'Mưa vừa',
    65: 'Mưa to',
    66: 'Mưa đóng băng nhẹ',
    67: 'Mưa đóng băng to',
    71: 'Tuyết nhẹ',
    73: 'Tuyết vừa',
    75: 'Tuyết dày',
    77: 'Hạt tuyết',
    80: 'Mưa rào nhẹ',
    81: 'Mưa rào vừa',
    82: 'Mưa rào to',
    85: 'Mưa tuyết nhẹ',
    86: 'Mưa tuyết to',
    95: 'Giông bão',
    96: 'Giông kèm mưa đá nhẹ',
    99: 'Giông kèm mưa đá to',
};

export function getWeatherDescription(code) {
    return WEATHER_CODES[code] || 'Không xác định';
}

/**
 * Fetch weather data for a district from Open-Meteo
 */
export async function fetchWeatherForDistrict(district) {
    if (!rateLimiter.canMakeCall()) {
        throw new Error(`Rate limit reached. Status: ${JSON.stringify(rateLimiter.getStatus())}`);
    }

    const params = new URLSearchParams({
        latitude: district.lat,
        longitude: district.lon,
        current: [
            'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
            'precipitation', 'rain', 'weather_code', 'wind_speed_10m',
            'wind_direction_10m', 'pressure_msl', 'uv_index'
        ].join(','),
        hourly: [
            'temperature_2m', 'relative_humidity_2m', 'precipitation_probability',
            'rain', 'weather_code', 'wind_speed_10m'
        ].join(','),
        daily: [
            'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
            'rain_sum', 'weather_code', 'uv_index_max'
        ].join(','),
        timezone: 'Asia/Ho_Chi_Minh',
        forecast_days: 7,
    });

    const url = `${BASE_URL}?${params}`;

    try {
        rateLimiter.recordCall();
        const data = await fetchJson(url);
        return parseWeatherResponse(data, district);
    } catch (error) {
        console.error(`❌ Error fetching weather for ${district.name}:`, error.message);
        throw error;
    }
}

/**
 * Parse Open-Meteo response into structured format
 */
function parseWeatherResponse(data, district) {
    // Current weather
    const current = {
        district_id: district.id,
        district_name: district.name,
        temperature: data.current.temperature_2m,
        feels_like: data.current.apparent_temperature,
        humidity: data.current.relative_humidity_2m,
        precipitation: data.current.precipitation,
        rain: data.current.rain,
        weather_code: data.current.weather_code,
        weather_description: getWeatherDescription(data.current.weather_code),
        wind_speed: data.current.wind_speed_10m,
        wind_direction: data.current.wind_direction_10m,
        pressure: data.current.pressure_msl,
        uv_index: data.current.uv_index,
        time: data.current.time,
    };

    // Daily forecast
    const daily = [];
    for (let i = 0; i < data.daily.time.length; i++) {
        daily.push({
            date: data.daily.time[i],
            temp_max: data.daily.temperature_2m_max[i],
            temp_min: data.daily.temperature_2m_min[i],
            precipitation_sum: data.daily.precipitation_sum[i],
            rain_sum: data.daily.rain_sum[i],
            weather_code: data.daily.weather_code[i],
            weather_description: getWeatherDescription(data.daily.weather_code[i]),
            uv_index_max: data.daily.uv_index_max[i],
        });
    }

    // Open-Meteo starts hourly data at local midnight, not at request time.
    // Keep the actual upcoming 48-hour window and store explicit UTC timestamps.
    const now = Date.now();
    const end = now + 48 * 60 * 60 * 1000;
    const hourly = [];
    for (let i = 0; i < data.hourly.time.length; i++) {
        const time = weatherTimeToUtc(data.hourly.time[i], data.utc_offset_seconds);
        const timestamp = Date.parse(time);
        if (timestamp < now || timestamp >= end) continue;
        hourly.push({
            time,
            temperature: data.hourly.temperature_2m[i],
            humidity: data.hourly.relative_humidity_2m[i],
            precipitation_probability: data.hourly.precipitation_probability[i],
            rain: data.hourly.rain[i],
            weather_code: data.hourly.weather_code[i],
            wind_speed: data.hourly.wind_speed_10m[i],
        });
    }

    return { current, daily, hourly };
}

/**
 * Fetch all districts with rate limiting
 */
export async function fetchAllDistricts(districts) {
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    const startTime = Date.now();

    for (const district of districts) {
        try {
            const data = await fetchWeatherForDistrict(district);
            results.push({ success: true, district: district.id, data });
            successCount++;
        } catch (error) {
            results.push({ success: false, district: district.id, error: error.message });
            errorCount++;
        }
        // Delay between calls to respect rate limits
        await rateLimiter.wait();
    }

    const durationMs = Date.now() - startTime;

    return {
        results,
        summary: {
            total: districts.length,
            success: successCount,
            errors: errorCount,
            durationMs,
            timestamp: new Date().toISOString(),
        },
    };
}
