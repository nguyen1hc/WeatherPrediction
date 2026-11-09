import { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import DistrictDetail from './components/DistrictDetail';
import './index.css';

function App() {
  const [weatherData, setWeatherData] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [freshness, setFreshness] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [weather, summary] = await Promise.all([
        api.getCurrentWeather(),
        api.getStats(),
      ]);
      setWeatherData(weather.data || []);
      setStats(summary);
      setFreshness(weather.freshness);
      setLastUpdate(weather.freshness?.lastUpdated ? new Date(weather.freshness.lastUpdated) : null);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Không tải được dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className="app">
        <Header lastUpdate={null} onRefresh={handleRefresh} />
        <div className="loading-screen">
          <div className="spinner" />
          <p>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header lastUpdate={lastUpdate} onRefresh={handleRefresh} />
      {(error || freshness?.state === 'stale' || freshness?.state === 'missing') && (
        <div className="data-warning" role="status">
          {error || (freshness.state === 'missing'
            ? 'Chưa có dữ liệu thời tiết. Hãy thêm địa điểm và chờ cập nhật.'
            : `Dữ liệu của ${freshness.staleCount} địa điểm đã quá 30 phút. Đang hiển thị dữ liệu đã lưu.`)}
        </div>
      )}
      {selectedDistrict ? (
        <DistrictDetail
          districtId={selectedDistrict}
          onBack={() => setSelectedDistrict(null)}
        />
      ) : (
        <Dashboard
          weatherData={weatherData}
          stats={stats}
          onSelectDistrict={setSelectedDistrict}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}

export default App;
