import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, Filler, Tooltip as ChartTooltip, Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import './WeatherChart.css';

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, Filler, ChartTooltip, Legend
);

const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } },
        },
    },
    scales: {
        x: {
            ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 }, maxRotation: 45 },
            grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
            ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
        },
    },
};

export function TemperatureChart({ history }) {
    const labels = history.map(h =>
        new Date(h.recorded_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    );

    const data = {
        labels,
        datasets: [
            {
                label: 'Nhiệt độ (°C)',
                data: history.map(h => h.temperature),
                borderColor: '#ff9800',
                backgroundColor: 'rgba(255, 152, 0, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 2,
            },
            {
                label: 'Cảm giác (°C)',
                data: history.map(h => h.feels_like),
                borderColor: '#ff5722',
                backgroundColor: 'rgba(255, 87, 34, 0.05)',
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                borderDash: [5, 5],
            },
        ],
    };

    return (
        <div className="chart-box">
            <h3 className="chart-title">🌡️ Nhiệt độ</h3>
            <div className="chart-wrapper">
                <Line data={data} options={CHART_DEFAULTS} />
            </div>
        </div>
    );
}

export function HumidityChart({ history }) {
    const labels = history.map(h =>
        new Date(h.recorded_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    );

    const data = {
        labels,
        datasets: [
            {
                label: 'Độ ẩm (%)',
                data: history.map(h => h.humidity),
                borderColor: '#42a5f5',
                backgroundColor: 'rgba(66, 165, 245, 0.15)',
                fill: true,
                tension: 0.4,
                pointRadius: 2,
            },
        ],
    };

    return (
        <div className="chart-box">
            <h3 className="chart-title">💧 Độ ẩm</h3>
            <div className="chart-wrapper">
                <Line data={data} options={CHART_DEFAULTS} />
            </div>
        </div>
    );
}

export function ForecastChart({ daily }) {
    const labels = daily.map(d => {
        const date = new Date(d.forecast_date);
        return date.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
    });

    const data = {
        labels,
        datasets: [
            {
                label: 'Cao nhất (°C)',
                data: daily.map(d => d.temp_max),
                backgroundColor: 'rgba(255, 152, 0, 0.7)',
                borderRadius: 6,
            },
            {
                label: 'Thấp nhất (°C)',
                data: daily.map(d => d.temp_min),
                backgroundColor: 'rgba(66, 165, 245, 0.7)',
                borderRadius: 6,
            },
        ],
    };

    return (
        <div className="chart-box">
            <h3 className="chart-title">📅 Dự báo 7 ngày</h3>
            <div className="chart-wrapper">
                <Bar data={data} options={CHART_DEFAULTS} />
            </div>
        </div>
    );
}

export function RainChart({ daily }) {
    const labels = daily.map(d => {
        const date = new Date(d.forecast_date);
        return date.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
    });

    const data = {
        labels,
        datasets: [
            {
                label: 'Lượng mưa (mm)',
                data: daily.map(d => d.precipitation_sum),
                backgroundColor: 'rgba(100, 181, 246, 0.6)',
                borderColor: '#64b5f6',
                borderWidth: 1,
                borderRadius: 6,
            },
        ],
    };

    return (
        <div className="chart-box">
            <h3 className="chart-title">🌧️ Lượng mưa dự báo</h3>
            <div className="chart-wrapper">
                <Bar data={data} options={CHART_DEFAULTS} />
            </div>
        </div>
    );
}
