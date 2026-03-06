/**
 * Weather utility helpers
 */

// Weather code → emoji + description (Vietnamese)
const WEATHER_MAP = {
    0: { emoji: '☀️', desc: 'Trời quang', bg: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
    1: { emoji: '🌤️', desc: 'Gần như quang', bg: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
    2: { emoji: '⛅', desc: 'Mây rải rác', bg: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' },
    3: { emoji: '☁️', desc: 'Nhiều mây', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    45: { emoji: '🌫️', desc: 'Sương mù', bg: 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)' },
    48: { emoji: '🌫️', desc: 'Sương mù muối', bg: 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)' },
    51: { emoji: '🌦️', desc: 'Mưa phùn nhẹ', bg: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' },
    53: { emoji: '🌦️', desc: 'Mưa phùn', bg: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' },
    55: { emoji: '🌧️', desc: 'Mưa phùn dày', bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    61: { emoji: '🌧️', desc: 'Mưa nhẹ', bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    63: { emoji: '🌧️', desc: 'Mưa vừa', bg: 'linear-gradient(135deg, #0250c5 0%, #d43f8d 100%)' },
    65: { emoji: '🌧️', desc: 'Mưa to', bg: 'linear-gradient(135deg, #0250c5 0%, #d43f8d 100%)' },
    80: { emoji: '🌦️', desc: 'Mưa rào nhẹ', bg: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' },
    81: { emoji: '🌧️', desc: 'Mưa rào vừa', bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    82: { emoji: '⛈️', desc: 'Mưa rào to', bg: 'linear-gradient(135deg, #0250c5 0%, #d43f8d 100%)' },
    95: { emoji: '⛈️', desc: 'Giông bão', bg: 'linear-gradient(135deg, #0c0c0c 0%, #434343 100%)' },
    96: { emoji: '⛈️', desc: 'Giông + mưa đá', bg: 'linear-gradient(135deg, #0c0c0c 0%, #434343 100%)' },
    99: { emoji: '⛈️', desc: 'Giông + mưa đá to', bg: 'linear-gradient(135deg, #0c0c0c 0%, #434343 100%)' },
};

export function getWeatherInfo(code) {
    return WEATHER_MAP[code] || { emoji: '🌡️', desc: 'Không xác định', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' };
}

export function getTempColor(temp) {
    if (temp >= 38) return '#ff1744';
    if (temp >= 35) return '#ff5722';
    if (temp >= 32) return '#ff9800';
    if (temp >= 28) return '#ffc107';
    if (temp >= 25) return '#8bc34a';
    if (temp >= 20) return '#00bcd4';
    return '#2196f3';
}

export function getUVLevel(uv) {
    if (uv >= 11) return { level: 'Cực cao', color: '#7b1fa2' };
    if (uv >= 8) return { level: 'Rất cao', color: '#d32f2f' };
    if (uv >= 6) return { level: 'Cao', color: '#f57c00' };
    if (uv >= 3) return { level: 'Trung bình', color: '#fbc02d' };
    return { level: 'Thấp', color: '#388e3c' };
}

export function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

export function windDirection(deg) {
    const dirs = ['B', 'ĐB', 'Đ', 'ĐN', 'N', 'TN', 'T', 'TB'];
    return dirs[Math.round(deg / 45) % 8];
}
