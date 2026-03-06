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

  const fetchData = useCallback(async () => {
    try {
      const [weather, summary] = await Promise.all([
        api.getCurrentWeather(),
        api.getStats(),
      ]);
      setWeatherData(weather.data || []);
      setStats(summary);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch data:', err);
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
