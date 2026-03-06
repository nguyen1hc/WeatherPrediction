/**
 * ML Forecasting Service
 * 
 * Models:
 * 1. ARIMA  → Temperature time-series forecasting
 * 2. Random Forest → Rain classification (rain/no rain) + weather type
 * 3. Simple Neural Net (LSTM-style) → Multi-feature prediction
 */

import ARIMA from 'arima';
import { RandomForestClassifier } from 'ml-random-forest';
import { fetchHistoricalData } from './historicalApi.js';
import {
    getWeatherHistory,
    getAllLatestWeather,
    getLocation,
} from '../db/database.js';
import { lstmForecastSpatial } from './lstmForecast.js';

// Cache for trained models
const modelCache = new Map();

// =====================================================
// ARIMA — Temperature Forecasting
// =====================================================

/**
 * Train ARIMA model on temperature data and forecast next N days
 */
export async function arimaForecast(districtId, forecastDays = 7) {
    const district = getLocation(districtId);
    if (!district) throw new Error(`Location ${districtId} not found`);

    // Get historical data (90 days)
    let historicalData;
    try {
        historicalData = await fetchHistoricalData(district, 90);
    } catch (err) {
        console.error(`Failed to fetch historical data for ${districtId}:`, err.message);
        // Fallback: use DB data
        const dbHistory = getWeatherHistory(districtId, 24 * 30);
        if (dbHistory.length < 10) {
            throw new Error('Not enough data for ARIMA. Need at least 10 data points.');
        }
        historicalData = dbHistory.map(h => ({
            temp_mean: h.temperature,
            date: h.recorded_at,
        }));
    }

    if (historicalData.length < 14) {
        throw new Error(`Not enough historical data (${historicalData.length} points, need 14+)`);
    }

    const tempSeries = historicalData.map(d => d.temp_mean);

    // Train ARIMA with auto parameters
    const arima = new ARIMA({
        p: 2,  // AR order
        d: 1,  // Differencing
        q: 1,  // MA order
        verbose: false,
    });

    arima.train(tempSeries);

    // Forecast
    const [predictions, errors] = arima.predict(forecastDays);

    // Build forecast result
    const lastDate = new Date(historicalData[historicalData.length - 1].date);
    const forecast = predictions.map((temp, i) => {
        const date = new Date(lastDate);
        date.setDate(date.getDate() + i + 1);
        return {
            date: date.toISOString().split('T')[0],
            predicted_temp: parseFloat(temp.toFixed(1)),
            confidence: errors ? parseFloat((1 - Math.abs(errors[i]) / 100).toFixed(3)) : 0.7,
        };
    });

    return {
        model: 'ARIMA(2,1,1)',
        district_id: districtId,
        training_points: tempSeries.length,
        forecast,
    };
}

// =====================================================
// Random Forest — Rain & Weather Classification
// =====================================================

// Map weather codes to classes
function weatherToRainClass(code) {
    // 0 = No rain, 1 = Light rain, 2 = Heavy rain
    if (code >= 80 || code >= 61) return 2;  // Heavy rain
    if (code >= 51 || code === 80) return 1;  // Light rain
    return 0;  // No rain
}

function weatherToCloudClass(code) {
    // 0 = Clear, 1 = Partly cloudy, 2 = Cloudy, 3 = Fog, 4 = Rain/Storm
    if (code <= 1) return 0;
    if (code <= 2) return 1;
    if (code <= 3) return 2;
    if (code <= 48) return 3;
    return 4;
}

const RAIN_LABELS = ['Không mưa', 'Mưa nhẹ', 'Mưa to'];
const CLOUD_LABELS = ['Trời quang', 'Ít mây', 'Nhiều mây', 'Sương mù', 'Mưa/Bão'];

/**
 * Train Random Forest for rain classification
 */
export async function randomForestPredict(districtId) {
    const district = getLocation(districtId);
    if (!district) throw new Error(`Location ${districtId} not found`);

    // Fetch historical data
    let historicalData;
    try {
        historicalData = await fetchHistoricalData(district, 90);
    } catch (err) {
        throw new Error('Cannot fetch historical data for Random Forest training');
    }

    if (historicalData.length < 20) {
        throw new Error(`Not enough data (${historicalData.length} points, need 20+)`);
    }

    // Prepare features: [temp_max, temp_min, humidity, wind_speed, prev_day_rain, day_of_year]
    const features = [];
    const rainLabels = [];
    const cloudLabels = [];

    for (let i = 1; i < historicalData.length; i++) {
        const curr = historicalData[i];
        const prev = historicalData[i - 1];

        features.push([
            curr.temp_max || 30,
            curr.temp_min || 24,
            curr.humidity_mean || 70,
            curr.wind_speed_max || 5,
            prev.rain || 0,
            new Date(curr.date).getMonth(),
        ]);

        rainLabels.push(weatherToRainClass(curr.weather_code));
        cloudLabels.push(weatherToCloudClass(curr.weather_code));
    }

    // Split: train on all, predict for "tomorrow" using latest data
    const rainClassifier = new RandomForestClassifier({
        nEstimators: 50,
        maxDepth: 10,
        seed: 42,
    });
    rainClassifier.train(features, rainLabels);

    const cloudClassifier = new RandomForestClassifier({
        nEstimators: 50,
        maxDepth: 10,
        seed: 42,
    });
    cloudClassifier.train(features, cloudLabels);

    // Predict for next days using latest data as base
    const latest = historicalData[historicalData.length - 1];
    const predictions = [];

    let prevRain = latest.rain || 0;

    for (let day = 1; day <= 7; day++) {
        const date = new Date(latest.date);
        date.setDate(date.getDate() + day);

        // Slightly vary features for future days
        const futureFeatures = [
            latest.temp_max + (Math.random() - 0.5) * 2,
            latest.temp_min + (Math.random() - 0.5) * 2,
            latest.humidity_mean + (Math.random() - 0.5) * 10,
            latest.wind_speed_max + (Math.random() - 0.5) * 3,
            prevRain,
            date.getMonth(),
        ];

        const rainPred = rainClassifier.predict([futureFeatures])[0];
        const cloudPred = cloudClassifier.predict([futureFeatures])[0];

        prevRain = rainPred > 0 ? (rainPred === 2 ? 15 : 3) : 0;

        predictions.push({
            date: date.toISOString().split('T')[0],
            rain_class: rainPred,
            rain_label: RAIN_LABELS[rainPred],
            cloud_class: cloudPred,
            cloud_label: CLOUD_LABELS[cloudPred],
        });
    }

    return {
        model: 'Random Forest (50 trees)',
        district_id: districtId,
        training_points: features.length,
        predictions,
    };
}

// =====================================================
// Simple Neural Network (LSTM-style) — Multi-feature
// =====================================================

/**
 * Minimal neural network for time-series prediction
 * Uses a simple feedforward network with backpropagation
 * (lightweight alternative to full LSTM)
 */
class SimpleNN {
    constructor(inputSize, hiddenSize, outputSize, learningRate = 0.01) {
        this.lr = learningRate;

        // Initialize weights with Xavier initialization
        this.W1 = this._randMatrix(inputSize, hiddenSize, inputSize);
        this.b1 = new Array(hiddenSize).fill(0);
        this.W2 = this._randMatrix(hiddenSize, outputSize, hiddenSize);
        this.b2 = new Array(outputSize).fill(0);
    }

    _randMatrix(rows, cols, fanIn) {
        const scale = Math.sqrt(2 / fanIn);
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => (Math.random() - 0.5) * 2 * scale)
        );
    }

    _tanh(x) { return Math.tanh(x); }
    _tanhDerivative(x) { return 1 - x * x; }

    forward(input) {
        // Hidden layer
        this.hidden = this.b1.map((b, j) => {
            let sum = b;
            for (let i = 0; i < input.length; i++) {
                sum += input[i] * this.W1[i][j];
            }
            return this._tanh(sum);
        });

        // Output layer
        this.output = this.b2.map((b, j) => {
            let sum = b;
            for (let i = 0; i < this.hidden.length; i++) {
                sum += this.hidden[i] * this.W2[i][j];
            }
            return sum; // Linear output for regression
        });

        return this.output;
    }

    train(input, target) {
        const output = this.forward(input);

        // Output error
        const outputError = output.map((o, i) => target[i] - o);

        // Hidden error
        const hiddenError = this.hidden.map((h, j) => {
            let err = 0;
            for (let k = 0; k < output.length; k++) {
                err += outputError[k] * this.W2[j][k];
            }
            return err * this._tanhDerivative(h);
        });

        // Update W2
        for (let i = 0; i < this.hidden.length; i++) {
            for (let j = 0; j < output.length; j++) {
                this.W2[i][j] += this.lr * outputError[j] * this.hidden[i];
                this.b2[j] += this.lr * outputError[j];
            }
        }

        // Update W1
        for (let i = 0; i < input.length; i++) {
            for (let j = 0; j < this.hidden.length; j++) {
                this.W1[i][j] += this.lr * hiddenError[j] * input[i];
                this.b1[j] += this.lr * hiddenError[j];
            }
        }

        return outputError.reduce((sum, e) => sum + e * e, 0) / output.length;
    }
}

/**
 * Normalize data to [0, 1] range
 */
function normalize(data, min, max) {
    return (data - min) / (max - min || 1);
}

function denormalize(data, min, max) {
    return data * (max - min) + min;
}

/**
 * Neural Network prediction for temperature, humidity, rain
 */
export async function neuralNetPredict(districtId, forecastDays = 7) {
    const district = getLocation(districtId);
    if (!district) throw new Error(`Location ${districtId} not found`);

    let historicalData;
    try {
        historicalData = await fetchHistoricalData(district, 90);
    } catch (err) {
        throw new Error('Cannot fetch historical data for Neural Net training');
    }

    if (historicalData.length < 20) {
        throw new Error(`Not enough data (${historicalData.length} points, need 20+)`);
    }

    // Find min/max for normalization
    const stats = {
        temp: { min: Infinity, max: -Infinity },
        humidity: { min: Infinity, max: -Infinity },
        rain: { min: 0, max: 50 },
    };

    historicalData.forEach(d => {
        if (d.temp_mean < stats.temp.min) stats.temp.min = d.temp_mean;
        if (d.temp_mean > stats.temp.max) stats.temp.max = d.temp_mean;
        if (d.humidity_mean < stats.humidity.min) stats.humidity.min = d.humidity_mean;
        if (d.humidity_mean > stats.humidity.max) stats.humidity.max = d.humidity_mean;
    });

    // Prepare windowed training data
    // Input: [temp_t-2, temp_t-1, hum_t-1, rain_t-1, month]
    // Output: [temp_t, rain_t]
    const WINDOW = 3;
    const nn = new SimpleNN(WINDOW * 3 + 1, 16, 2, 0.005);

    const trainingData = [];
    for (let i = WINDOW; i < historicalData.length; i++) {
        const input = [];
        for (let w = WINDOW; w >= 1; w--) {
            const d = historicalData[i - w];
            input.push(normalize(d.temp_mean, stats.temp.min, stats.temp.max));
            input.push(normalize(d.humidity_mean || 70, stats.humidity.min, stats.humidity.max));
            input.push(normalize(d.rain || 0, stats.rain.min, stats.rain.max));
        }
        input.push(new Date(historicalData[i].date).getMonth() / 11);

        const target = [
            normalize(historicalData[i].temp_mean, stats.temp.min, stats.temp.max),
            normalize(Math.min(historicalData[i].rain || 0, 50), stats.rain.min, stats.rain.max),
        ];

        trainingData.push({ input, target });
    }

    // Train for multiple epochs
    const EPOCHS = 100;
    let lastLoss = 0;

    for (let epoch = 0; epoch < EPOCHS; epoch++) {
        let totalLoss = 0;
        for (const { input, target } of trainingData) {
            totalLoss += nn.train(input, target);
        }
        lastLoss = totalLoss / trainingData.length;
    }

    // Predict future days
    const predictions = [];
    let recentData = historicalData.slice(-WINDOW);

    for (let day = 1; day <= forecastDays; day++) {
        const input = [];
        for (const d of recentData) {
            input.push(normalize(d.temp_mean, stats.temp.min, stats.temp.max));
            input.push(normalize(d.humidity_mean || 70, stats.humidity.min, stats.humidity.max));
            input.push(normalize(d.rain || 0, stats.rain.min, stats.rain.max));
        }
        const predDate = new Date(historicalData[historicalData.length - 1].date);
        predDate.setDate(predDate.getDate() + day);
        input.push(predDate.getMonth() / 11);

        const output = nn.forward(input);

        const predTemp = denormalize(output[0], stats.temp.min, stats.temp.max);
        const predRain = Math.max(0, denormalize(output[1], stats.rain.min, stats.rain.max));

        predictions.push({
            date: predDate.toISOString().split('T')[0],
            predicted_temp: parseFloat(predTemp.toFixed(1)),
            predicted_rain: parseFloat(predRain.toFixed(1)),
        });

        // Shift window
        recentData.push({
            temp_mean: predTemp,
            humidity_mean: recentData[recentData.length - 1].humidity_mean,
            rain: predRain,
        });
        recentData = recentData.slice(-WINDOW);
    }

    return {
        model: 'Neural Network (3-layer, tanh)',
        district_id: districtId,
        training_points: trainingData.length,
        training_loss: parseFloat(lastLoss.toFixed(6)),
        epochs: EPOCHS,
        predictions,
    };
}

// =====================================================
// Combined Forecast — Ensemble of all models
// =====================================================

export async function ensembleForecast(districtId) {
    const results = {
        district_id: districtId,
        models: {},
        ensemble: [],
    };

    // Run all models
    try {
        results.models.arima = await arimaForecast(districtId);
    } catch (err) {
        results.models.arima = { error: err.message };
    }

    try {
        results.models.random_forest = await randomForestPredict(districtId);
    } catch (err) {
        results.models.random_forest = { error: err.message };
    }

    try {
        results.models.neural_net = await lstmForecastSpatial(districtId);
    } catch (err) {
        results.models.neural_net = { error: err.message };
    }

    // Create ensemble average for temperature
    const arimaFc = results.models.arima?.forecast || [];
    const nnFc = results.models.neural_net?.predictions || [];
    const rfFc = results.models.random_forest?.predictions || [];

    const maxDays = Math.max(arimaFc.length, nnFc.length, rfFc.length);

    for (let i = 0; i < maxDays; i++) {
        const temps = [];
        if (arimaFc[i]?.predicted_temp) temps.push(arimaFc[i].predicted_temp);
        if (nnFc[i]?.predicted_temp) temps.push(nnFc[i].predicted_temp);

        const avgTemp = temps.length > 0
            ? parseFloat((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1))
            : null;

        results.ensemble.push({
            date: arimaFc[i]?.date || nnFc[i]?.date || rfFc[i]?.date,
            predicted_temp: avgTemp,
            predicted_rain: nnFc[i]?.predicted_rain || null,
            rain_label: rfFc[i]?.rain_label || null,
            cloud_label: rfFc[i]?.cloud_label || null,
        });
    }

    return results;
}
