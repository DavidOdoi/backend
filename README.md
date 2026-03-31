# Logistics Backend (Node.js + Express + MongoDB)

REST API for the logistics app (`https://logistics-dun-iota.vercel.app/`). Now includes auth, drivers, load assignment, and matching.

## Quick start
1. `cd server`
2. Copy env vars: `cp .env.example .env` and fill `MONGO_URI`/`MONGODB_URI`, `JWT_SECRET`, optional `ALLOWED_ORIGIN`.
3. Install deps: `npm install`
4. (Optional) Seed demo drivers: `npm run seed:drivers`
5. Run dev server: `npm run dev` (PORT default 5000)

## Environment variables
- `PORT` (default 5000)
- `MONGO_URI` or `MONGODB_URI` (required) Atlas connection string
- `ALLOWED_ORIGIN` (recommended) e.g. `https://logistics-dun-iota.vercel.app`
- `JWT_SECRET` (required for auth)
- `JWT_EXPIRES_IN` (optional, default `7d`)
- `JWT_ISSUER` (optional)
- `GRAPHHOPPER_KEY` (optional; enables geocoding + distance/ETA scoring for matches)
- `MAPBOX_TOKEN` (optional fallback; used only if GraphHopper key is not set)

## Auth
- `POST /api/v1/auth/register` body `{ name, email, phone?, password, role: trader|driver }`
- `POST /api/v1/auth/login` body `{ email, password }`
Returns `{ user, token }` (JWT Bearer). Passwords are hashed with bcrypt.

## Loads (`/api/v1/loads`)
- `POST /` (trader/admin) create load
- `GET /` (auth) list loads; `?status=` filter; `?mine=true` shows only loads posted by the current user; `?assigned=me` shows loads assigned to the current driver
- `GET /:id` fetch one
- `PATCH /:id` update (owner/admin)
- `DELETE /:id` delete (owner/admin)
- `GET /:id/matches` suggested drivers (score + reasons)
- `POST /:id/assign` (admin) assign specific driver `{ driverId }`
- `POST /:id/accept` (driver) accept an open load (links driver profile)
- `POST /:id/status` (owner/assigned-driver/admin) change status to `open|assigned|in_transit|delivered|cancelled`

## Drivers (`/api/v1/drivers`)
- `POST /` (driver/admin) create a driver profile
- `GET /` list drivers, `?status=available|busy|off`
- `GET /:id` fetch driver
- `PATCH /:id` (driver/admin) update
- `DELETE /:id` (admin) delete

## Matching
- In-app scoring with strict requirements for truck type, capacity, and special requirements.
- If `GRAPHHOPPER_KEY` is set, locations are geocoded and driver-to-pickup distance/ETA are added to the score and returned in match results.
- If GraphHopper is not configured but `MAPBOX_TOKEN` is set, Mapbox is used as a fallback.

## Response shape
All endpoints respond with `{ success, data, message? }`; errors return `{ success: false, message, errors? }`.

## Deploy (Render/Railway)
- Set env vars above. Use start command `npm start`, root `server`.
- Point frontend `VITE_BACKEND_URL` to the deployed base URL.
