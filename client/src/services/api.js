const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

async function postJson(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

async function deleteReq(url) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

export const api = {
    // Locations
    getLocations: () => fetchJson(`${API_BASE}/locations`),
    addLocation: (loc) => postJson(`${API_BASE}/locations`, loc),
    addLocationByCoords: (lat, lon, name) => postJson(`${API_BASE}/locations/coords`, { lat, lon, name }),
    deleteLocation: (id) => deleteReq(`${API_BASE}/locations/${id}`),
    geocode: (q) => fetchJson(`${API_BASE}/geocode?q=${encodeURIComponent(q)}`),

    // Weather
    getCurrentWeather: () => fetchJson(`${API_BASE}/weather/current`),
    getDistrictWeather: (id) => fetchJson(`${API_BASE}/weather/current/${id}`),
    getHistory: (id, hours = 24) => fetchJson(`${API_BASE}/weather/history/${id}?hours=${hours}`),
    getForecast: (id) => fetchJson(`${API_BASE}/weather/forecast/${id}`),
    getStats: () => fetchJson(`${API_BASE}/stats/summary`),
    getStatus: () => fetchJson(`${API_BASE}/status`),

    // ML Forecast
    getMLArima: (id) => fetchJson(`${API_BASE}/ml/arima/${id}`),
    getMLRandomForest: (id) => fetchJson(`${API_BASE}/ml/random-forest/${id}`),
    getMLNeuralNet: (id) => fetchJson(`${API_BASE}/ml/neural-net/${id}`),
    getMLEnsemble: (id) => fetchJson(`${API_BASE}/ml/ensemble/${id}`),
};
