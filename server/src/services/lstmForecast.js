/**
 * Advanced Deep Learning LSTM Forecast with Spatial Context
 * Uses TensorFlow.js to build a real LSTM network predicting weather
 * based on the target location AND its nearest neighbors (spatial context).
 */

import * as tf from '@tensorflow/tfjs';
import { fetchHistoricalData } from './historicalApi.js';
import { getLocation, getAllLocations } from '../db/database.js';

// Calculate distance between two GPS coordinates (Haversine formula)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Find K nearest active locations to provide spatial context
function getNearestNeighbors(targetLoc, k = 3) {
    const allLocs = getAllLocations().filter(l => l.is_active && l.id !== targetLoc.id);
    if (allLocs.length === 0) return [];

    const distances = allLocs.map(loc => ({
        ...loc,
        distance: getDistanceFromLatLonInKm(targetLoc.lat, targetLoc.lon, loc.lat, loc.lon)
    }));

    distances.sort((a, b) => a.distance - b.distance);
    return distances.slice(0, k);
}

// Data normalization
class DataScaler {
    constructor() {
        this.mins = {};
        this.maxs = {};
    }

    fit(data, keys) {
        keys.forEach(key => {
            const vals = data.map(d => d[key] || 0);
            this.mins[key] = Math.min(...vals);
            this.maxs[key] = Math.max(...vals);
            // Prevent division by zero
            if (this.mins[key] === this.maxs[key]) {
                this.maxs[key] += 1;
            }
        });
    }

    transform(data, keys) {
        return data.map(d => {
            const row = {};
            keys.forEach(key => {
                const val = d[key] || 0;
                row[key] = (val - this.mins[key]) / (this.maxs[key] - this.mins[key]);
            });
            return row;
        });
    }

    inverseTransform(val, key) {
        return val * (this.maxs[key] - this.mins[key]) + this.mins[key];
    }
}

/**
 * Main export variable for the model
 */
export async function lstmForecastSpatial(locationId, forecastDays = 7) {
    const location = getLocation(locationId);
    if (!location) throw new Error(`Location ${locationId} not found`);

    // 1. Find neighbors for spatial context
    const neighbors = getNearestNeighbors(location, 3);
    console.log(`🤖 LSTM Spatial: Found ${neighbors.length} neighbors for ${location.name}`);

    // 2. Fetch historical data for target and neighbors
    const DAYS_HISTORY = 90;
    const targetData = await fetchHistoricalData(location, DAYS_HISTORY);

    if (targetData.length < 30) {
        throw new Error(`Not enough historical data (${targetData.length} points, need 30+)`);
    }

    // Attempt to fetch neighbor data
    const neighborDataMap = {};
    for (const nb of neighbors) {
        try {
            neighborDataMap[nb.id] = await fetchHistoricalData(nb, DAYS_HISTORY);
        } catch (err) {
            console.warn(`Could not fetch history for neighbor ${nb.name}`);
        }
    }

    // 3. Prepare dataset combining Target + Neighbors
    // Features for each day: 
    // Target: [temp, humidity, rain]
    // Nghbrs: [avg_temp, avg_humidity, avg_rain] (aggregated spatial features)
    const combinedData = [];

    for (let i = 0; i < targetData.length; i++) {
        const tDate = targetData[i].date;
        const targetRow = targetData[i];

        // Aggregate neighbor data for this specific date
        let nbTempSum = 0, nbHumSum = 0, nbRainSum = 0, nbCount = 0;

        for (const nbId in neighborDataMap) {
            const nbRow = neighborDataMap[nbId].find(d => d.date === tDate);
            if (nbRow) {
                nbTempSum += nbRow.temp_mean;
                nbHumSum += (nbRow.humidity_mean || 70);
                nbRainSum += (nbRow.rain || 0);
                nbCount++;
            }
        }

        combinedData.push({
            date: tDate,
            target_temp: targetRow.temp_mean,
            target_hum: targetRow.humidity_mean || 70,
            target_rain: targetRow.rain || 0,
            spatial_temp: nbCount > 0 ? nbTempSum / nbCount : targetRow.temp_mean,
            spatial_hum: nbCount > 0 ? nbHumSum / nbCount : (targetRow.humidity_mean || 70),
            spatial_rain: nbCount > 0 ? nbRainSum / nbCount : (targetRow.rain || 0),
        });
    }

    // 4. Scale data
    const featureKeys = ['target_temp', 'target_hum', 'target_rain', 'spatial_temp', 'spatial_hum', 'spatial_rain'];
    const scaler = new DataScaler();
    scaler.fit(combinedData, featureKeys);
    const scaledData = scaler.transform(combinedData, featureKeys);

    // 5. Create Sequences (Windowing)
    const TIME_STEPS = 5; // Look back 5 days to predict the next
    const X = [];
    const y = [];

    for (let i = TIME_STEPS; i < scaledData.length; i++) {
        const window = [];
        for (let w = TIME_STEPS; w >= 1; w--) {
            const row = scaledData[i - w];
            window.push([
                row.target_temp, row.target_hum, row.target_rain,
                row.spatial_temp, row.spatial_hum, row.spatial_rain
            ]);
        }
        X.push(window);
        // Predict target temp and rain for the next day
        y.push([scaledData[i].target_temp, scaledData[i].target_rain]);
    }

    if (X.length === 0) throw new Error("Dataset too small after windowing");

    // Convert to Tensors
    const xs = tf.tensor3d(X); // Shape: [samples, time_steps, features]
    const ys = tf.tensor2d(y); // Shape: [samples, output_features]

    // 6. Build TensorFlow.js LSTM Model
    const model = tf.sequential();

    // LSTM Layer
    model.add(tf.layers.lstm({
        units: 32,
        inputShape: [TIME_STEPS, featureKeys.length],
        returnSequences: false
    }));

    // Dense Layers
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2 })); // outputs: temp, rain

    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError'
    });

    // 7. Train Model
    const EPOCHS = 50;
    console.log(`🤖 Training TensorFlow LSTM for ${EPOCHS} epochs...`);

    let finalLoss = 0;
    await model.fit(xs, ys, {
        epochs: EPOCHS,
        batchSize: 16,
        shuffle: true,
        verbose: 0,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                finalLoss = logs.loss;
                if ((epoch + 1) % 10 === 0) {
                    console.log(`   Epoch ${epoch + 1}/${EPOCHS} — Loss: ${logs.loss.toFixed(4)}`);
                }
            }
        }
    });

    // Clean up training tensors
    xs.dispose();
    ys.dispose();

    // 8. Forecast Future Days
    const predictions = [];

    // Start with the last time window from our historical data
    let currentWindow = scaledData.slice(-TIME_STEPS).map(row => [
        row.target_temp, row.target_hum, row.target_rain,
        row.spatial_temp, row.spatial_hum, row.spatial_rain
    ]);

    const lastDate = new Date(combinedData[combinedData.length - 1].date);

    for (let day = 1; day <= forecastDays; day++) {
        const inputTensor = tf.tensor3d([currentWindow]);

        // Predict
        const predictionTensor = model.predict(inputTensor);
        const predValues = await predictionTensor.array();

        inputTensor.dispose();
        predictionTensor.dispose();

        const [predTempScaled, predRainScaled] = predValues[0];

        // Denormalize
        const predTemp = scaler.inverseTransform(predTempScaled, 'target_temp');
        let predRain = scaler.inverseTransform(predRainScaled, 'target_rain');

        // Clip rain to non-negative
        predRain = Math.max(0, predRain);

        // Date calculation
        const forecastDate = new Date(lastDate);
        forecastDate.setDate(forecastDate.getDate() + day);

        predictions.push({
            date: forecastDate.toISOString().split('T')[0],
            predicted_temp: parseFloat(predTemp.toFixed(1)),
            predicted_rain: parseFloat(predRain.toFixed(1))
        });

        // Update window for next step (recursive forecasting)
        // Assume spatial context stays roughly same as last known (naive assumption for future)
        const lastKnownSpatial = currentWindow[currentWindow.length - 1];

        const nextStepRow = [
            predTempScaled,
            currentWindow[currentWindow.length - 1][1], // Keep humidity same
            predRainScaled,
            lastKnownSpatial[3], lastKnownSpatial[4], lastKnownSpatial[5]
        ];

        currentWindow.shift(); // Remove oldest
        currentWindow.push(nextStepRow); // Add newest prediction
    }

    // Cleanup model
    model.dispose();

    return {
        model: 'TensorFlow LSTM (Deep Learning)',
        algorithm: 'tensorflow_lstm',
        district_id: locationId,
        training_points: combinedData.length,
        spatial_neighbors: neighbors.length,
        training_loss: parseFloat(finalLoss.toFixed(5)),
        epochs: EPOCHS,
        predictions,
    };
}
