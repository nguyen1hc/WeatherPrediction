import { getWeatherInfo, getTempColor } from '../services/weather';
import './DistrictCard.css';

function DistrictCard({ data, onClick }) {
    const weather = getWeatherInfo(data.weather_code);
    const tempColor = getTempColor(data.temperature);

    return (
        <div className="district-card" onClick={onClick}>
            <div className="card-weather-bg" style={{ background: weather.bg }}>
                <span className="card-emoji">{weather.emoji}</span>
            </div>
            <div className="card-body">
                <h3 className="card-district-name">{data.district?.name || data.district_id}</h3>
                <p className="card-weather-desc">{weather.desc}</p>
                <div className="card-temp" style={{ color: tempColor }}>
                    {data.temperature?.toFixed(1)}°C
                </div>
                <div className="card-details">
                    <span title="Cảm giác như">🌡️ {data.feels_like?.toFixed(1)}°</span>
                    <span title="Độ ẩm">💧 {data.humidity}%</span>
                    <span title="Gió">💨 {data.wind_speed?.toFixed(1)} km/h</span>
                </div>
                {(data.rain > 0) && (
                    <div className="card-rain">🌧️ {data.rain} mm</div>
                )}
            </div>
        </div>
    );
}

export default DistrictCard;
