/**
 * ML Forecast API routes — using dynamic locations
 */

import { Router } from 'express';
import {
    arimaForecast,
    randomForestPredict,
    ensembleForecast,
} from '../services/forecast.js';
import { lstmForecastSpatial } from '../services/lstmForecast.js';
import { getLocation } from '../db/database.js';

const router = Router();

// --- GET /api/ml/arima/:locationId ---
router.get('/ml/arima/:locationId', async (req, res) => {
    try {
        const { locationId } = req.params;
        const days = parseInt(req.query.days) || 7;

        const location = getLocation(locationId);
        if (!location) return res.status(404).json({ error: 'Location not found' });

        console.log(`🧠 Running ARIMA for ${location.name}...`);
        const result = await arimaForecast(locationId, days);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET /api/ml/random-forest/:locationId ---
router.get('/ml/random-forest/:locationId', async (req, res) => {
    try {
        const { locationId } = req.params;

        const location = getLocation(locationId);
        if (!location) return res.status(404).json({ error: 'Location not found' });

        console.log(`🌲 Running Random Forest for ${location.name}...`);
        const result = await randomForestPredict(locationId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET /api/ml/neural-net/:locationId ---
router.get('/ml/neural-net/:locationId', async (req, res) => {
    try {
        const { locationId } = req.params;
        const days = parseInt(req.query.days) || 7;

        const location = getLocation(locationId);
        if (!location) return res.status(404).json({ error: 'Location not found' });

        console.log(`🤖 Running TensorFlow LSTM Spatial for ${location.name}...`);
        const result = await lstmForecastSpatial(locationId, days);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET /api/ml/ensemble/:locationId ---
router.get('/ml/ensemble/:locationId', async (req, res) => {
    try {
        const { locationId } = req.params;

        const location = getLocation(locationId);
        if (!location) return res.status(404).json({ error: 'Location not found' });

        console.log(`🎯 Running Ensemble for ${location.name}...`);
        const result = await ensembleForecast(locationId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
