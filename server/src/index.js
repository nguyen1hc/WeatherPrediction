/**
 * TPHCM Weather Forecast Server
 * Entry point
 */

import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/database.js';
import { startScheduler } from './services/scheduler.js';
import weatherRoutes from './routes/weather.js';
import forecastRoutes from './routes/forecast.js';
import locationRoutes from './routes/locations.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (!req.url.includes('/status')) { // Don't log health checks
            console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
        }
    });
    next();
});

// Routes
app.use('/api', weatherRoutes);
app.use('/api', forecastRoutes);
app.use('/api', locationRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'TPHCM Weather Forecast API',
        version: '1.0.0',
        docs: {
            districts: '/api/districts',
            currentAll: '/api/weather/current',
            currentOne: '/api/weather/current/:districtId',
            history: '/api/weather/history/:districtId?hours=24',
            forecast: '/api/weather/forecast/:districtId',
            stats: '/api/stats/summary',
            status: '/api/status',
            mlArima: '/api/ml/arima/:districtId',
            mlRandomForest: '/api/ml/random-forest/:districtId',
            mlNeuralNet: '/api/ml/neural-net/:districtId',
            mlEnsemble: '/api/ml/ensemble/:districtId',
        },
    });
});

// Initialize and start
async function start() {
    try {
        // Init database
        initDatabase();

        // Start server
        const server = app.listen(PORT, () => {
            console.log(`\n🚀 TPHCM Weather Server running at http://localhost:${server.address().port}`);
            console.log(`📡 API docs: http://localhost:${server.address().port}/`);
            console.log(`📊 Status: http://localhost:${server.address().port}/api/status\n`);
        });

        // Start weather data collection scheduler
        if (process.env.DISABLE_SCHEDULER !== '1') startScheduler();

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

start();
