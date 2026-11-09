import { freshness } from '../services/freshness.js';
/**
 * Weather API routes — now using dynamic locations from DB
 */

import { Router } from 'express';
import { getWeatherDescription } from '../services/weatherApi.js';
import {
    getAllLatestWeather,
    getLatestWeather,
    getWeatherHistory,
    getDailyForecast,
    getHourlyForecast,
    getLatestFetchLog,
    getRecordCount,
    getLocation,
    getAllLocations,
} from '../db/database.js';
import { getSchedulerStatus } from '../services/scheduler.js';
import rateLimiter from '../utils/rateLimiter.js';

const router = Router();

// --- GET /api/weather/current ---
router.get('/weather/current', (req, res) => {
    try {
        const data = getAllLatestWeather();
        const locations = getAllLocations();

        const enriched = data.map(w => {
            const loc = locations.find(l => l.id === w.district_id);
            return {
                ...w,
                weather_description: getWeatherDescription(w.weather_code),
                district: loc ? { id: loc.id, name: loc.name, lat: loc.lat, lon: loc.lon } : null,
            };
        });

        res.json({
            freshness: freshness(data),
            count: enriched.length,
            timestamp: new Date().toISOString(),
            data: enriched,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET /api/weather/current/:locationId ---
router.get('/weather/current/:locationId', (req, res) => {
    try {
        const { locationId } = req.params;
        const location = getLocation(locationId);

        const data = getLatestWeather(locationId);
        if (!data) {
            return res.status(404).json({ error: 'No weather data yet for this location.' });
        }

        res.json({
            ...data,
            weather_description: getWeatherDescription(data.weather_code),
            district: location ? { id: location.id, name: location.name, lat: location.lat, lon: location.lon } : null,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET /api/weather/history/:locationId ---
router.get('/weather/history/:locationId', (req, res) => {
    try {
        const { locationId } = req.params;
        const hours = parseInt(req.query.hours) || 24;
        const location = getLocation(locationId);

        const data = getWeatherHistory(locationId, hours);

        res.json({
            district: location ? { id: location.id, name: location.name, lat: location.lat, lon: location.lon } : null,
            hours,
            count: data.length,
            data: data.map(w => ({
                ...w,
                weather_description: getWeatherDescription(w.weather_code),
            })),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET /api/weather/forecast/:locationId ---
router.get('/weather/forecast/:locationId', (req, res) => {
    try {
        const { locationId } = req.params;
        const location = getLocation(locationId);

        const daily = getDailyForecast(locationId);
        const hourly = getHourlyForecast(locationId);

        res.json({
            district: location ? { id: location.id, name: location.name, lat: location.lat, lon: location.lon } : null,
            daily: daily.map(f => ({
                ...f,
                weather_description: getWeatherDescription(f.weather_code),
            })),
            hourly: hourly.map(h => ({
                ...h,
                weather_description: getWeatherDescription(h.weather_code),
            })),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET /api/stats/summary ---
router.get('/stats/summary', (req, res) => {
    try {
        const allWeather = getAllLatestWeather();
        const locations = getAllLocations();

        if (allWeather.length === 0) {
            return res.json({ message: 'No data yet. Add locations and wait for data collection.' });
        }

        const temps = allWeather.map(w => w.temperature).filter(t => t != null);
        const humidities = allWeather.map(w => w.humidity).filter(h => h != null);

        const findLocName = (districtId) => locations.find(l => l.id === districtId)?.name || districtId;

        const hottestDistrict = allWeather.reduce((a, b) => (a.temperature > b.temperature ? a : b));
        const coolestDistrict = allWeather.reduce((a, b) => (a.temperature < b.temperature ? a : b));
        const rainiest = allWeather.reduce((a, b) => ((a.rain || 0) > (b.rain || 0) ? a : b));

        res.json({
            timestamp: new Date().toISOString(),
            locations_reporting: allWeather.length,
            temperature: {
                avg: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
                max: Math.max(...temps),
                min: Math.min(...temps),
                hottest: {
                    location: findLocName(hottestDistrict.district_id),
                    temp: hottestDistrict.temperature,
                },
                coolest: {
                    location: findLocName(coolestDistrict.district_id),
                    temp: coolestDistrict.temperature,
                },
            },
            humidity: {
                avg: (humidities.reduce((a, b) => a + b, 0) / humidities.length).toFixed(1),
            },
            rainiest: {
                location: findLocName(rainiest.district_id),
                rain_mm: rainiest.rain,
            },
            records: getRecordCount(),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET /api/status ---
router.get('/status', (req, res) => {
    const scheduler = getSchedulerStatus();
    const rateStatus = rateLimiter.getStatus();
    const records = getRecordCount();
    const fetchLog = getLatestFetchLog();
    const locations = getAllLocations();

    res.json({
        status: freshness(getAllLatestWeather()).state === 'fresh' && !scheduler.lastFetch?.errors ? 'running' : 'degraded',
        freshness: freshness(getAllLatestWeather()),
        uptime: process.uptime(),
        activeLocations: locations.filter(l => l.is_active).length,
        totalLocations: locations.length,
        scheduler,
        rateLimiter: rateStatus,
        records,
        recentFetches: fetchLog,
    });
});

export default router;
