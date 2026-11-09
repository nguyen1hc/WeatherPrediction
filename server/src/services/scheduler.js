/**
 * Scheduler - Automatically fetch weather data on interval
 * Now supports dynamic user locations
 */

import cron from 'node-cron';
import { fetchWeatherForDistrict } from './weatherApi.js';
import {
    getActiveLocations,
    storeWeather,
    insertFetchLog,
    cleanOldData,
} from '../db/database.js';
import rateLimiter from '../utils/rateLimiter.js';

let isRunning = false;
let lastFetchResult = null;
let scheduledTask = null;

/**
 * Fetch and store weather for a single location
 */
export async function collectWeatherForLocation(location) {
    try {
        const data = await fetchWeatherForDistrict(location);
        storeWeather(location.id, data);
        return { success: true, location: location.id };
    } catch (error) {
        console.error(`❌ Error fetching ${location.name}:`, error.message);
        return { success: false, location: location.id, error: error.message };
    }
}

/**
 * Fetch and store weather data for all active locations
 */
export async function collectWeatherData() {
    if (isRunning) {
        console.log('⚠️ Previous fetch still running, skipping...');
        return null;
    }

    const locations = getActiveLocations();
    if (locations.length === 0) {
        console.log('📍 No active locations. Add some via the API or UI.');
        return null;
    }

    isRunning = true;
    const startTime = Date.now();
    console.log(`\n🌤️  [${new Date().toLocaleString('vi-VN')}] Fetching weather for ${locations.length} locations...`);

    let successCount = 0;
    let errorCount = 0;

    try {
        for (const location of locations) {
            const result = await collectWeatherForLocation(location);
            if (result.success) successCount++;
            else errorCount++;
            await rateLimiter.wait();
        }

        const durationMs = Date.now() - startTime;

        insertFetchLog(locations.length, successCount, errorCount, durationMs);

        lastFetchResult = {
            total: locations.length,
            success: successCount,
            errors: errorCount,
            durationMs,
            timestamp: new Date().toISOString(),
        };

        console.log(`✅ Fetch complete: ${successCount}/${locations.length} success in ${durationMs}ms`);
        return lastFetchResult;
    } finally {
        isRunning = false;
    }
}

/**
 * Start the scheduled collection (every 15 minutes)
 */
export function startScheduler(cronExpression = '*/15 * * * *') {
    // Run immediately on startup
    collectWeatherData().catch(error => console.error('Weather collection failed:', error.message));

    // Schedule periodic collection
    scheduledTask = cron.schedule(cronExpression, () => {
        collectWeatherData().catch(error => console.error('Weather collection failed:', error.message));
    });

    // Clean old data daily at 3:00 AM
    cron.schedule('0 3 * * *', () => {
        console.log('🧹 Running daily cleanup...');
        cleanOldData();
    });

    console.log(`⏰ Scheduler started: collecting every 15 minutes`);
    return scheduledTask;
}

export function stopScheduler() {
    if (scheduledTask) {
        scheduledTask.stop();
        console.log('⏹️ Scheduler stopped');
    }
}

export function getSchedulerStatus() {
    return {
        isRunning,
        lastFetch: lastFetchResult,
        schedulerActive: scheduledTask !== null,
    };
}
