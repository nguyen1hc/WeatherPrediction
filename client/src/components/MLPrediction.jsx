import { useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement,
    Filler, Tooltip as ChartTooltip, Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { api } from '../services/api';
import { getTempColor } from '../services/weather';
import './MLPrediction.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip, Legend);

const MODELS = [
    { id: 'arima', name: 'ARIMA', icon: '📈', color: '#ff9800', desc: 'Time-series' },
    { id: 'random-forest', name: 'Random Forest', icon: '🌲', color: '#4caf50', desc: 'Classification' },
    { id: 'neural-net', name: 'LSTM (Spatial)', icon: '🧠', color: '#9c27b0', desc: 'Deep Learning' },
    { id: 'ensemble', name: 'Ensemble', icon: '🎯', color: '#2196f3', desc: 'Combined' },
];

function MLPrediction({ districtId }) {
    const [results, setResults] = useState({});
    const [loading, setLoading] = useState({});
    const [activeModel, setActiveModel] = useState(null);

    const runModel = async (modelId) => {
        setLoading(prev => ({ ...prev, [modelId]: true }));
        setActiveModel(modelId);

        try {
            let data;
            switch (modelId) {
                case 'arima':
                    data = await api.getMLArima(districtId);
                    break;
                case 'random-forest':
                    data = await api.getMLRandomForest(districtId);
                    break;
                case 'neural-net':
                    data = await api.getMLNeuralNet(districtId);
                    break;
                case 'ensemble':
                    data = await api.getMLEnsemble(districtId);
                    break;
            }
            setResults(prev => ({ ...prev, [modelId]: data }));
        } catch (err) {
            setResults(prev => ({ ...prev, [modelId]: { error: err.message } }));
        } finally {
            setLoading(prev => ({ ...prev, [modelId]: false }));
        }
    };

    const runAll = async () => {
        for (const model of MODELS) {
            await runModel(model.id);
        }
    };

    // Build comparison chart data
    const getComparisonData = () => {
        const arima = results['arima']?.forecast || [];
        const nn = results['neural-net']?.predictions || [];
        const ensemble = results['ensemble']?.ensemble || [];

        const maxLen = Math.max(arima.length, nn.length, ensemble.length);
        if (maxLen === 0) return null;

        const labels = (arima.length ? arima : nn.length ? nn : ensemble).map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
        });

        const datasets = [];

        if (arima.length > 0) {
            datasets.push({
                label: '📈 ARIMA',
                data: arima.map(d => d.predicted_temp),
                borderColor: '#ff9800',
                backgroundColor: 'rgba(255, 152, 0, 0.1)',
                tension: 0.4,
                pointRadius: 4,
                borderWidth: 2,
            });
        }

        if (nn.length > 0) {
            datasets.push({
                label: '🧠 LSTM (Spatial)',
                data: nn.map(d => d.predicted_temp),
                borderColor: '#9c27b0',
                backgroundColor: 'rgba(156, 39, 176, 0.1)',
                tension: 0.4,
                pointRadius: 4,
                borderWidth: 2,
            });
        }

        if (ensemble.length > 0 && ensemble[0]?.predicted_temp) {
            datasets.push({
                label: '🎯 Ensemble',
                data: ensemble.map(d => d.predicted_temp),
                borderColor: '#2196f3',
                backgroundColor: 'rgba(33, 150, 243, 0.15)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                borderWidth: 3,
            });
        }

        return { labels, datasets };
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } },
            },
        },
        scales: {
            x: {
                ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
                grid: { color: 'rgba(255,255,255,0.05)' },
            },
            y: {
                ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
                grid: { color: 'rgba(255,255,255,0.05)' },
            },
        },
    };

    const comparisonData = getComparisonData();

    return (
        <div className="ml-prediction">
            <h3 className="section-title">🧠 Dự báo bằng ML</h3>

            {/* Model selector buttons */}
            <div className="model-buttons">
                {MODELS.map(m => (
                    <button
                        key={m.id}
                        className={`model-btn ${activeModel === m.id ? 'active' : ''} ${results[m.id] ? 'done' : ''}`}
                        onClick={() => runModel(m.id)}
                        disabled={loading[m.id]}
                        style={{ '--model-color': m.color }}
                    >
                        {loading[m.id] ? (
                            <span className="btn-spinner" />
                        ) : (
                            <span className="btn-icon">{m.icon}</span>
                        )}
                        <span className="btn-name">{m.name}</span>
                        <span className="btn-desc">{m.desc}</span>
                    </button>
                ))}
                <button className="model-btn run-all" onClick={runAll}>
                    <span className="btn-icon">🚀</span>
                    <span className="btn-name">Chạy tất cả</span>
                    <span className="btn-desc">3 models</span>
                </button>
            </div>

            {/* Comparison chart */}
            {comparisonData && (
                <div className="ml-chart-box">
                    <h4 className="ml-chart-title">📊 So sánh dự đoán nhiệt độ (°C)</h4>
                    <div className="ml-chart-wrapper">
                        <Line data={comparisonData} options={chartOptions} />
                    </div>
                </div>
            )}

            {/* Individual model results */}
            <div className="ml-results">
                {/* ARIMA results */}
                {results['arima'] && !results['arima'].error && (
                    <div className="ml-result-card">
                        <div className="ml-result-header">
                            <span>📈 ARIMA</span>
                            <span className="ml-meta">{results['arima'].model} • {results['arima'].training_points} points</span>
                        </div>
                        <div className="ml-result-body">
                            {results['arima'].forecast?.map((f, i) => (
                                <div className="ml-pred-row" key={i}>
                                    <span className="pred-date">{new Date(f.date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}</span>
                                    <span className="pred-temp" style={{ color: getTempColor(f.predicted_temp) }}>
                                        {f.predicted_temp}°C
                                    </span>
                                    <span className="pred-conf">±{((1 - f.confidence) * 5).toFixed(1)}°</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Random Forest results */}
                {results['random-forest'] && !results['random-forest'].error && (
                    <div className="ml-result-card">
                        <div className="ml-result-header">
                            <span>🌲 Random Forest</span>
                            <span className="ml-meta">{results['random-forest'].model} • {results['random-forest'].training_points} points</span>
                        </div>
                        <div className="ml-result-body">
                            {results['random-forest'].predictions?.map((p, i) => (
                                <div className="ml-pred-row" key={i}>
                                    <span className="pred-date">{new Date(p.date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}</span>
                                    <span className={`pred-tag tag-${p.rain_class}`}>{p.rain_label}</span>
                                    <span className="pred-cloud">{p.cloud_label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Neural Net results */}
                {results['neural-net'] && !results['neural-net'].error && (
                    <div className="ml-result-card">
                        <div className="ml-result-header">
                            <span>🧠 TensorFlow LSTM (Spatial)</span>
                            <span className="ml-meta">
                                Loss: {results['neural-net'].training_loss} • {results['neural-net'].spatial_neighbors} Lân cận
                            </span>
                        </div>
                        <div className="ml-result-body">
                            {results['neural-net'].predictions?.map((p, i) => (
                                <div className="ml-pred-row" key={i}>
                                    <span className="pred-date">{new Date(p.date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}</span>
                                    <span className="pred-temp" style={{ color: getTempColor(p.predicted_temp) }}>
                                        {p.predicted_temp}°C
                                    </span>
                                    <span className="pred-rain">🌧️ {p.predicted_rain} mm</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Errors */}
                {Object.entries(results).map(([key, val]) =>
                    val?.error ? (
                        <div className="ml-error" key={key}>
                            ⚠️ {MODELS.find(m => m.id === key)?.name}: {val.error}
                        </div>
                    ) : null
                )}
            </div>
        </div>
    );
}

export default MLPrediction;
