# WeatherPrediction

React/Vite dashboard and Express/SQLite weather API using Open-Meteo.

## Development

Use Node.js 24 and npm. No API key is required. From this checkout:

```sh
cd server
npm ci
NODE_USE_ENV_PROXY=1 DB_PATH=/workspace/.weather-runtime/weather.db npm run dev
```

In a second terminal:

```sh
cd client
npm ci
VITE_API_URL=http://localhost:3000/api npm run dev
```

`NODE_USE_ENV_PROXY=1` enables Node fetch to use inherited HTTP(S) proxies on Node 24.
Preserve CA trust and TLS verification. Allow HTTPS access to
`api.open-meteo.com`, `geocoding-api.open-meteo.com`, and `archive-api.open-meteo.com`.
Without that access, stored data can be displayed but cannot be refreshed.
`DB_PATH` is optional; the default is `server/data/weather.db`, created on first run.
Dependencies and runtime SQLite files are ignored; existing local files are retained.

## Validation

```sh
cd server
npm test
cd ../client
npm run lint
npm run build
```

GitHub Actions runs these checks for pushes and pull requests. Backend tests use
in-memory and temporary SQLite databases with no public weather API dependency.
They cover HTTP retries/timeouts, atomic storage, duplicate readings, freshness,
hourly time windows and real HTTP endpoints. CI also tests hourly forecasts under
a different server timezone. `DISABLE_SCHEDULER=1` disables collection for isolated tests;
production should leave it unset.

## Data health

`GET /api/weather/current` includes `freshness`: state (`fresh`, `stale`, `missing`),
stale location count, oldest last-fetch timestamp and a 30-minute freshness limit.
The dashboard displays stale-data, missing-data and API-error messages. The header
shows data collection time rather than page-refresh time.
`GET /api/status` reports `degraded` when data is missing/stale or the last collection
had errors; HTTP 200 still means the status endpoint itself is reachable.

Each location refresh commits current, daily and hourly data in one transaction.
Forecast tables are replaced per location; current readings retain history.
Upstream requests have a 10-second timeout and at most two retries for network
failures, HTTP 429 and 5xx responses. Other HTTP failures are not retried.

Hourly forecasts cover the next 48 hours from collection time, rather than the
first two calendar days in the upstream response. Only available future points
are returned; missing upstream hours are not fabricated. Hourly timestamps are
stored and returned as ISO 8601 UTC (`Z`). Existing timestamps without an offset
are read as Vietnam time (UTC+7), matching the original Open-Meteo request, without
rewriting the database. The API excludes points before now and at or beyond the
end of the requested window.
