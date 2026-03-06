import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { getWeatherInfo, getTempColor } from '../services/weather';
import 'leaflet/dist/leaflet.css';
import './DistrictMap.css';

const DEFAULT_CENTER = [10.78, 106.67]; // Fallback to TPHCM

function DistrictMap({ weatherData, onSelectDistrict }) {
    // Auto-center map based on locations
    const { center, zoom } = useMemo(() => {
        const validLocations = weatherData.filter(w => w.district?.lat && w.district?.lon);
        if (validLocations.length === 0) return { center: DEFAULT_CENTER, zoom: 5 };

        const lats = validLocations.map(w => w.district.lat);
        const lons = validLocations.map(w => w.district.lon);

        const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
        const centerLon = (Math.max(...lons) + Math.min(...lons)) / 2;

        const latSpan = Math.max(...lats) - Math.min(...lats);
        const lonSpan = Math.max(...lons) - Math.min(...lons);
        const span = Math.max(latSpan, lonSpan);

        let z = 12;
        if (span > 50) z = 3;
        else if (span > 20) z = 4;
        else if (span > 10) z = 5;
        else if (span > 5) z = 6;
        else if (span > 2) z = 7;
        else if (span > 1) z = 8;
        else if (span > 0.5) z = 9;
        else if (span > 0.2) z = 10;
        else if (span > 0.05) z = 11;

        return { center: [centerLat, centerLon], zoom: z };
    }, [weatherData]);

    return (
        <div className="map-container">
            <h2 className="section-title">🗺️ Bản đồ thời tiết</h2>
            <MapContainer
                key={`${center[0]}-${center[1]}-${zoom}`}
                center={center}
                zoom={zoom}
                className="leaflet-map"
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {weatherData.map((w) => {
                    if (!w.district) return null;
                    const color = getTempColor(w.temperature);
                    const weather = getWeatherInfo(w.weather_code);

                    return (
                        <CircleMarker
                            key={w.district_id}
                            center={[w.district.lat, w.district.lon]}
                            radius={14}
                            fillColor={color}
                            color={color}
                            weight={2}
                            opacity={0.8}
                            fillOpacity={0.5}
                            eventHandlers={{
                                click: () => onSelectDistrict(w.district_id),
                            }}
                        >
                            <Tooltip direction="top" permanent className="map-tooltip">
                                <span>{w.temperature?.toFixed(0)}°</span>
                            </Tooltip>
                            <Popup>
                                <div className="map-popup">
                                    <strong>{w.district.name}</strong>
                                    <br />
                                    {weather.emoji} {weather.desc}
                                    <br />
                                    🌡️ {w.temperature?.toFixed(1)}°C (Cảm giác: {w.feels_like?.toFixed(1)}°)
                                    <br />
                                    💧 {w.humidity}% | 💨 {w.wind_speed?.toFixed(1)} km/h
                                </div>
                            </Popup>
                        </CircleMarker>
                    );
                })}
            </MapContainer>
        </div>
    );
}

export default DistrictMap;
