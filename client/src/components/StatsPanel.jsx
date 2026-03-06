import './StatsPanel.css';

function StatsPanel({ stats }) {
    if (!stats || stats.message) return null;

    return (
        <div className="stats-panel">
            <div className="stat-card stat-temp">
                <div className="stat-icon">🌡️</div>
                <div className="stat-info">
                    <div className="stat-value">{stats.temperature?.avg}°C</div>
                    <div className="stat-label">Nhiệt độ TB</div>
                </div>
            </div>

            <div className="stat-card stat-hot">
                <div className="stat-icon">🔥</div>
                <div className="stat-info">
                    <div className="stat-value">{stats.temperature?.hottest?.temp?.toFixed(1)}°C</div>
                    <div className="stat-label">Nóng nhất — {stats.temperature?.hottest?.location}</div>
                </div>
            </div>

            <div className="stat-card stat-cool">
                <div className="stat-icon">❄️</div>
                <div className="stat-info">
                    <div className="stat-value">{stats.temperature?.coolest?.temp?.toFixed(1)}°C</div>
                    <div className="stat-label">Mát nhất — {stats.temperature?.coolest?.location}</div>
                </div>
            </div>

            <div className="stat-card stat-humidity">
                <div className="stat-icon">💧</div>
                <div className="stat-info">
                    <div className="stat-value">{stats.humidity?.avg}%</div>
                    <div className="stat-label">Độ ẩm TB</div>
                </div>
            </div>

            <div className="stat-card stat-rain">
                <div className="stat-icon">🌧️</div>
                <div className="stat-info">
                    <div className="stat-value">{stats.rainiest?.rain_mm || 0} mm</div>
                    <div className="stat-label">Mưa — {stats.rainiest?.location || 'Không mưa'}</div>
                </div>
            </div>

            <div className="stat-card stat-records">
                <div className="stat-icon">📊</div>
                <div className="stat-info">
                    <div className="stat-value">{stats.records?.current?.toLocaleString()}</div>
                    <div className="stat-label">Bản ghi đã thu thập</div>
                </div>
            </div>
        </div>
    );
}

export default StatsPanel;
