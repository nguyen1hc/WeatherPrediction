/**
 * Location management routes
 */

import { Router } from 'express';
import { searchLocation } from '../services/geocoding.js';
import {
    addLocation,
    deleteLocation,
    getLocation,
    getAllLocations,
    getActiveLocations,
    addLocationByCoords,
} from '../db/database.js';
import { collectWeatherForLocation } from '../services/scheduler.js';

const router = Router();

// --- GET /api/locations ---
router.get('/locations', (req, res) => {
    try {
        const locations = getAllLocations();
        res.json({ count: locations.length, locations });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET /api/locations/:id ---
router.get('/locations/:id', (req, res) => {
    try {
        const location = getLocation(req.params.id);
        if (!location) return res.status(404).json({ error: 'Location not found' });
        res.json(location);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- POST /api/locations --- Add a location from geocoding result
router.post('/locations', async (req, res) => {
    try {
        const loc = req.body;
        if (!loc.lat || !loc.lon || !loc.name) {
            return res.status(400).json({ error: 'lat, lon, and name are required' });
        }

        // Generate ID if not provided
        if (!loc.id) {
            loc.id = `loc-${loc.lat.toFixed(4)}-${loc.lon.toFixed(4)}`;
        }

        addLocation(loc);

        // Immediately fetch weather for this location
        try {
            await collectWeatherForLocation({ id: loc.id, name: loc.name, lat: loc.lat, lon: loc.lon });
        } catch (err) {
            console.error('Initial weather fetch failed:', err.message);
        }

        const saved = getLocation(loc.id);
        res.status(201).json(saved);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- POST /api/locations/coords --- Add by coordinates directly
router.post('/locations/coords', async (req, res) => {
    try {
        const { lat, lon, name } = req.body;
        if (lat == null || lon == null) {
            return res.status(400).json({ error: 'lat and lon are required' });
        }

        addLocationByCoords(parseFloat(lat), parseFloat(lon), name);
        const id = `custom-${parseFloat(lat).toFixed(4)}-${parseFloat(lon).toFixed(4)}`;

        // Fetch weather immediately
        try {
            await collectWeatherForLocation({
                id, name: name || `${lat}, ${lon}`,
                lat: parseFloat(lat), lon: parseFloat(lon),
            });
        } catch (err) {
            console.error('Initial weather fetch failed:', err.message);
        }

        const saved = getLocation(id);
        res.status(201).json(saved);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- DELETE /api/locations/:id ---
router.delete('/locations/:id', (req, res) => {
    try {
        deleteLocation(req.params.id);
        res.json({ success: true, message: 'Location and its weather data deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET /api/geocode --- Search locations
router.get('/geocode', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 characters' });
        }

        const results = await searchLocation(q);
        res.json({ count: results.length, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
