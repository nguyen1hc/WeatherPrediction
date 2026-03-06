/**
 * Geocoding service using Open-Meteo Geocoding API (free, no key)
 * Search for locations by name → get lat/lon
 */

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/**
 * Search for locations by name
 * @param {string} query - Location name (city, district, etc.)
 * @param {number} count - Max results
 * @returns {Array} List of matching locations
 */
export async function searchLocation(query, count = 10) {
    const params = new URLSearchParams({
        name: query,
        count: count,
        language: 'vi',
        format: 'json',
    });

    const response = await fetch(`${GEOCODING_URL}?${params}`);
    if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
        return [];
    }

    return data.results.map(r => ({
        id: `loc-${r.id}`,
        geocoding_id: r.id,
        name: r.name,
        country: r.country || '',
        country_code: r.country_code || '',
        admin1: r.admin1 || '', // State/Province
        admin2: r.admin2 || '', // District
        lat: r.latitude,
        lon: r.longitude,
        elevation: r.elevation || null,
        timezone: r.timezone || 'Asia/Ho_Chi_Minh',
        display_name: buildDisplayName(r),
    }));
}

function buildDisplayName(r) {
    const parts = [r.name];
    if (r.admin2) parts.push(r.admin2);
    if (r.admin1) parts.push(r.admin1);
    if (r.country) parts.push(r.country);
    return parts.join(', ');
}
