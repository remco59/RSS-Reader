# RSS Reader

A self-hosted feed aggregator built with Nuxt, PocketBase, and a Node.js fetcher service.

## Stack

- **Nuxt** — frontend and server-side rendering (port 3000)
- **PocketBase** — database and admin UI (port 8090)
- **Fetcher** — background service that polls feeds on a per-feed interval (port 3001)

## Getting started

1. Copy the example env file and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

2. Start all services:
   ```bash
   docker compose up
   ```

   The app is available at [http://localhost:3000](http://localhost:3000) and the PocketBase admin at [http://localhost:8090/_/](http://localhost:8090/_/).

## Fetcher

The fetcher runs automatically every 5 minutes and only re-fetches a feed when its `fetch_interval_mins` has elapsed since `last_fetched`.

### Manual trigger

Trigger a normal fetch (still respects each feed's interval):
```bash
curl -X POST http://localhost:3001/fetch
```

Force-fetch all active feeds, ignoring `last_fetched`:
```bash
curl -X POST "http://localhost:3001/fetch?force=true"
```

The fetcher port defaults to `3001` and can be overridden with `FETCHER_API_PORT` in `.env`.
