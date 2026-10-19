# GeoCrete ARC Group

React frontend and Node.js API for local development.

- `client` — React 19 app built with Vite
- `server` — Express API

## Prerequisites

Node.js 20 or newer.

## Setup

```bash
npm install
npm run dev
```

- App: http://localhost:5173
- API health: http://localhost:5000/api/health

The Vite dev server proxies `/api` to the Express server.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API and the React app together |
| `npm run dev:client` | Starts only the React app |
| `npm run dev:server` | Starts only the API |
| `npm run build` | Builds the React app into `client/dist` |
| `npm start` | Serves the API. With `NODE_ENV=production`, it also serves the built app |
| `npm run lint` | Lints the React app |

## Production

```bash
npm run build
```

On Windows PowerShell:

```powershell
$env:NODE_ENV = "production"
npm start
```

On macOS or Linux:

```bash
NODE_ENV=production npm start
```

The API then serves the built frontend and the `/api` routes from http://localhost:5000.

Copy `server/.env.example` to `server/.env` to change the port or the allowed browser origin.
