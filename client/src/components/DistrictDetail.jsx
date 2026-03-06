import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { getWeatherInfo, getTempColor, getUVLevel, windDirection } from '../services/weather';
import { TemperatureChart, HumidityChart, ForecastChart, RainChart } from './WeatherChart';
import MLPrediction from './MLPrediction';
import './DistrictDetail.css';

function DistrictDetail({ districtId, onBack }) {
    const [current, setCurrent] = useState(null);
    const [history, setHistory] = useState([]);
    const [forecast, setForecast] = useState({ daily: [], hourly: [] });
    const [loading, setLoading] = useState(true);
    const [historyHours, setHistoryHours] = useState(24);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [cur, hist, fc] = await Promise.all([
                    api.getDistrictWeather(districtId),
                    api.getHistory(districtId, historyHours),
                    api.getForecast(districtId),
                ]);
                setCurrent(cur);
                setHistory(hist.data || []);
                setForecast({ daily: fc.daily || [], hourly: fc.hourly || [] });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [districtId, historyHours]);

    if (loading) {
        return (
            <div className="detail-page">
                <div className="loading-screen"><div className="spinner" /><p>Đang tải...</p></div>
            </div>
        );
    }

    if (!current) {
        return (
            <div className="detail-page">
                <button className="back-btn" onClick={onBack}>← Quay lại</button>
                <p style={{ color: '#fff', textAlign: 'center' }}>Chưa có dữ liệu</p>
            </div>
        );
    }

    const weather = getWeatherInfo(current.weather_code);
    const tempColor = getTempColor(current.temperature);
    const uv = getUVLevel(current.uv_index);

    return (
        <div className="detail-page">
            <button className="back-btn" onClick={onBack}>← Quay lại tổng quan</button>

            {/* Hero */}
            <div className="detail-hero" style={{ background: weather.bg }}>
                <div className="hero-content">
                    <div className="hero-left">
                        <h1 className="hero-district">{current.district?.name || districtId}</h1>
                        <p className="hero-desc">{weather.emoji} {weather.desc}</p>
                        <div className="hero-temp" style={{ color: '#fff' }}>
                            {current.temperature?.toFixed(1)}°C
                        </div>
                        <p className="hero-feels">Cảm giác như {current.feels_like?.toFixed(1)}°C</p>
                    </div>
                    <div className="hero-right">
                        <span className="hero-big-emoji">{weather.emoji}</span>
                    </div>
                </div>
            </div>

            {/* Detail metrics */}
            <div className="detail-metrics">
                <div className="metric">
                    <span className="metric-icon">💧</span>
                    <span className="metric-val">{current.humidity}%</span>
                    <span className="metric-label">Độ ẩm</span>
                </div>
                <div className="metric">
                    <span className="metric-icon">💨</span>
                    <span className="metric-val">{current.wind_speed?.toFixed(1)} km/h</span>
                    <span className="metric-label">Gió {windDirection(current.wind_direction)}</span>
                </div>
                <div className="metric">
                    <span className="metric-icon">🌡️</span>
                    <span className="metric-val">{current.pressure?.toFixed(0)} hPa</span>
                    <span className="metric-label">Áp suất</span>
                </div>
                <div className="metric">
                    <span className="metric-icon">☀️</span>
                    <span className="metric-val" style={{ color: uv.color }}>{current.uv_index?.toFixed(1)}</span>
                    <span className="metric-label">UV — {uv.level}</span>
                </div>
                <div className="metric">
                    <span className="metric-icon">🌧️</span>
                    <span className="metric-val">{current.rain || 0} mm</span>
                    <span className="metric-label">Mưa</span>
                </div>
                <div className="metric">
                    <span className="metric-icon">🌊</span>
                    <span className="metric-val">{current.precipitation || 0} mm</span>
                    <span className="metric-label">Lượng kết tủa</span>
                </div>
            </div>

            {/* History hours selector */}
            <div className="history-selector">
                <span>Lịch sử: </span>
                {[6, 12, 24, 48, 72].map(h => (
                    <button
                        key={h}
                        className={`history-btn ${historyHours === h ? 'active' : ''}`}
                        onClick={() => setHistoryHours(h)}
                    >
                        {h}h
                    </button>
                ))}
            </div>

            {/* Charts */}
            <div className="charts-grid">
                {history.length > 1 && <TemperatureChart history={history} />}
                {history.length > 1 && <HumidityChart history={history} />}
                {forecast.daily.length > 0 && <ForecastChart daily={forecast.daily} />}
                {forecast.daily.length > 0 && <RainChart daily={forecast.daily} />}
            </div>

            {/* Daily forecast table */}
            {forecast.daily.length > 0 && (
                <div className="forecast-table-container">
                    <h3 className="section-title">📅 Dự báo 7 ngày</h3>
                    <div className="forecast-days">
                        {forecast.daily.map((day, i) => {
                            const dw = getWeatherInfo(day.weather_code);
                            return (
                                <div className="forecast-day" key={i}>
                                    <span className="fd-date">
                                        {new Date(day.forecast_date).toLocaleDateString('vi-VN', {
                                            weekday: 'short', day: 'numeric', month: 'numeric'
                                        })}
                                    </span>
                                    <span className="fd-emoji">{dw.emoji}</span>
                                    <span className="fd-temps">
                                        <span className="fd-max" style={{ color: getTempColor(day.temp_max) }}>
                                            {day.temp_max?.toFixed(0)}°
                                        </span>
                                        <span className="fd-min">
                                            {day.temp_min?.toFixed(0)}°
                                        </span>
                                    </span>
                                    <span className="fd-rain">🌧️ {day.precipitation_sum?.toFixed(1)} mm</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ML Predictions */}
            <MLPrediction districtId={districtId} />
        </div>
    );
}

export default DistrictDetail;
