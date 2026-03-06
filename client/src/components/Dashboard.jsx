import LocationSearch from './LocationSearch';
import DistrictCard from './DistrictCard';
import DistrictMap from './DistrictMap';
import StatsPanel from './StatsPanel';
import { api } from '../services/api';
import './Dashboard.css';

function Dashboard({ weatherData, stats, onSelectDistrict, onRefresh }) {
    const handleDelete = async (e, locationId) => {
        e.stopPropagation();
        if (!confirm('Xóa vị trí này?')) return;
        try {
            await api.deleteLocation(locationId);
            onRefresh();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    return (
        <main className="dashboard">
            <LocationSearch onLocationAdded={onRefresh} />

            {stats && <StatsPanel stats={stats} />}

            {weatherData.length > 0 && (
                <DistrictMap weatherData={weatherData} onSelectDistrict={onSelectDistrict} />
            )}

            <section className="districts-section">
                <h2 className="section-title">📍 Vị trí đang theo dõi ({weatherData.length})</h2>
                {weatherData.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">🔍</span>
                        <p>Chưa có vị trí nào. Tìm kiếm và thêm vị trí để bắt đầu!</p>
                    </div>
                ) : (
                    <div className="districts-grid">
                        {weatherData.map((w) => (
                            <div key={w.district_id} className="card-wrapper">
                                <DistrictCard
                                    data={w}
                                    onClick={() => onSelectDistrict(w.district_id)}
                                />
                                <button
                                    className="delete-location-btn"
                                    onClick={(e) => handleDelete(e, w.district_id)}
                                    title="Xóa vị trí"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

export default Dashboard;
