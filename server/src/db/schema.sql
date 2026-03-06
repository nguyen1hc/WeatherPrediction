-- User-managed locations (any location worldwide)
CREATE TABLE IF NOT EXISTS user_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  country TEXT,
  country_code TEXT,
  admin1 TEXT,
  admin2 TEXT,
  timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Weather current readings
CREATE TABLE IF NOT EXISTS weather_current (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  district_id TEXT NOT NULL,
  temperature REAL,
  feels_like REAL,
  humidity REAL,
  precipitation REAL,
  rain REAL,
  weather_code INTEGER,
  wind_speed REAL,
  wind_direction REAL,
  pressure REAL,
  uv_index REAL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7-day forecast from API
CREATE TABLE IF NOT EXISTS weather_forecast (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  district_id TEXT NOT NULL,
  forecast_date DATE,
  temp_max REAL,
  temp_min REAL,
  precipitation_sum REAL,
  rain_sum REAL,
  weather_code INTEGER,
  uv_index_max REAL,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Hourly forecast from API
CREATE TABLE IF NOT EXISTS weather_hourly (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  district_id TEXT NOT NULL,
  forecast_time DATETIME,
  temperature REAL,
  humidity REAL,
  precipitation_probability REAL,
  rain REAL,
  weather_code INTEGER,
  wind_speed REAL,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ML predictions
CREATE TABLE IF NOT EXISTS ml_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  district_id TEXT NOT NULL,
  prediction_date DATE,
  predicted_temp REAL,
  predicted_humidity REAL,
  predicted_rain REAL,
  model_name TEXT,
  confidence REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API fetch log
CREATE TABLE IF NOT EXISTS fetch_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  districts_fetched INTEGER,
  success_count INTEGER,
  error_count INTEGER,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_current_district ON weather_current(district_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_forecast_district ON weather_forecast(district_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_hourly_district ON weather_hourly(district_id, forecast_time);
CREATE INDEX IF NOT EXISTS idx_ml_district ON ml_predictions(district_id, prediction_date);
