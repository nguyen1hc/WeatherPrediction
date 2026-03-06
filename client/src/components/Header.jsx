import './Header.css';

function Header({ lastUpdate, onRefresh }) {
    return (
        <header className="header">
            <div className="header-content">
                <div className="header-left">
                    <h1 className="header-title">
                        <span className="header-icon">🌤️</span>
                        Weather Station
                    </h1>
                    <p className="header-subtitle">Thời tiết Real-time — Bất kỳ vị trí nào</p>
                </div>
                <div className="header-right">
                    {lastUpdate && (
                        <span className="last-update">
                            🔄 {lastUpdate.toLocaleTimeString('vi-VN')}
                        </span>
                    )}
                    <button className="refresh-btn" onClick={onRefresh} title="Cập nhật">
                        ↻
                    </button>
                </div>
            </div>
        </header>
    );
}

export default Header;
