import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import './LocationSearch.css';

function LocationSearch({ onLocationAdded }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);
    const searchRef = useRef(null);
    const timeoutRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClick = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Debounced search
    const handleSearch = (value) => {
        setQuery(value);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (value.length < 2) {
            setResults([]);
            setShowResults(false);
            return;
        }

        timeoutRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await api.geocode(value);
                setResults(data.results || []);
                setShowResults(true);
            } catch (err) {
                console.error('Geocoding error:', err);
            } finally {
                setLoading(false);
            }
        }, 300);
    };

    // Add location from search result
    const addFromSearch = async (result) => {
        try {
            await api.addLocation({
                id: result.id,
                name: result.name,
                display_name: result.display_name,
                lat: result.lat,
                lon: result.lon,
                country: result.country,
                country_code: result.country_code,
                admin1: result.admin1,
                admin2: result.admin2,
                timezone: result.timezone,
            });
            setQuery('');
            setResults([]);
            setShowResults(false);
            if (onLocationAdded) onLocationAdded();
        } catch (err) {
            console.error('Failed to add location:', err);
        }
    };

    // Use browser geolocation
    const useMyLocation = () => {
        if (!navigator.geolocation) {
            alert('Trình duyệt không hỗ trợ GPS');
            return;
        }

        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    await api.addLocationByCoords(pos.coords.latitude, pos.coords.longitude, 'Vị trí của tôi');
                    if (onLocationAdded) onLocationAdded();
                } catch (err) {
                    console.error('Failed to add location:', err);
                } finally {
                    setGeoLoading(false);
                }
            },
            (err) => {
                console.error('Geolocation error:', err);
                alert('Không thể lấy vị trí. Hãy cho phép truy cập GPS.');
                setGeoLoading(false);
            }
        );
    };

    return (
        <div className="location-search" ref={searchRef}>
            <div className="search-input-group">
                <div className="search-input-wrap">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Tìm kiếm vị trí (VD: Hà Nội, Tokyo, Paris...)"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        onFocus={() => results.length > 0 && setShowResults(true)}
                    />
                    {loading && <span className="search-spinner" />}
                </div>
                <button
                    className="geo-btn"
                    onClick={useMyLocation}
                    disabled={geoLoading}
                    title="Dùng vị trí GPS"
                >
                    {geoLoading ? '⏳' : '📍'} Vị trí của tôi
                </button>
            </div>

            {showResults && results.length > 0 && (
                <div className="search-results">
                    {results.map((r) => (
                        <div
                            key={r.id}
                            className="search-result-item"
                            onClick={() => addFromSearch(r)}
                        >
                            <span className="result-flag">{r.country_code ? getFlagEmoji(r.country_code) : '📍'}</span>
                            <div className="result-info">
                                <span className="result-name">{r.name}</span>
                                <span className="result-detail">{r.display_name}</span>
                            </div>
                            <span className="result-coords">{r.lat.toFixed(2)}, {r.lon.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function getFlagEmoji(countryCode) {
    try {
        const code = countryCode.toUpperCase();
        return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
    } catch {
        return '🌍';
    }
}

export default LocationSearch;
