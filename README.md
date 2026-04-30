# Logistics Backend (Node.js + Express + MongoDB)

REST API for the eLogistics platform. Includes auth, role-based access, shipments, tracking, trucks, drivers, payments, user profile, and dashboard APIs.

## Quick start
1. `cd backend`
2. Copy env vars from `.env.example` into `.env`
3. Install dependencies: `npm install`
4. Optional seed: `npm run seed:drivers`
5. Run locally: `npm run dev` (default `PORT=5000`)

## Production `.env` checklist
Before deployment, confirm:
- [ ] `MONGO_URI` (or `MONGODB_URI`) is valid and reachable
- [ ] `JWT_SECRET` is long and random (not default)
- [ ] `ALLOWED_ORIGIN` matches deployed frontend URL
- [ ] `NODE_ENV=production`
- [ ] `PORT` is set according to host requirements
- [ ] Optional geocoding keys configured if needed (`GRAPHHOPPER_KEY` or `MAPBOX_TOKEN`)

Reference template: `backend/.env.example`

## API quick reference

### Health
- `GET /health`

### Auth (`/api/v1/auth`)
- `POST /register` -> register user (`customer|staff|admin|trader|driver`)
- `POST /login` -> login and receive JWT
- `GET /me` -> current authenticated user

### Users (`/api/v1/users`)
- `GET /me` -> profile info
- `PATCH /me` -> update profile fields (`name`, `location`, `phone`, etc.)

### Dashboard (`/api/v1/dashboard`)
- `GET /overview` -> aggregate stats and activity feed

### Loads / Shipments (`/api/v1/loads`)
- `POST /` -> create shipment
- `GET /` -> list shipments (`status`, `mine=true`, `assigned=me`)
- `GET /:id` -> shipment details
- `PATCH /:id` -> update shipment
- `DELETE /:id` -> delete shipment
- `GET /track/:trackingId` -> public tracking by tracking ID
- `GET /:id/matches` -> suggested drivers
- `POST /:id/assign` -> assign driver (admin)
- `POST /:id/accept` -> accept shipment (driver/staff)
- `POST /:id/status` -> status transition

### Drivers (`/api/v1/drivers`)
- `POST /` -> create driver profile
- `GET /` -> list drivers (`status` filter)
- `GET /:id` -> driver details
- `PATCH /:id` -> update driver
- `DELETE /:id` -> delete driver

### Trucks (`/api/v1/trucks`)
- `POST /` -> create truck
- `GET /` -> list trucks (`status`, `assigned=true|false`)
- `GET /:id` -> truck details
- `PATCH /:id` -> update truck
- `DELETE /:id` -> delete truck
- `POST /:id/assign-driver` -> attach driver to truck
- `POST /:id/unassign-driver` -> detach driver from truck
- `POST /:id/movement` -> simulate movement/location and update linked shipment timeline

### Payments (`/api/v1/payments`)
- `POST /` -> initiate payment (mock-friendly, works immediately)
- `GET /` -> list payments (`mine=true`, `status`, `shipmentId`)
- `GET /:id` -> payment details
- `PATCH /:id` -> update payment status (`pending|paid|failed|refunded`)
- `POST /:id/simulate` -> simulate outcome (staff/admin)
- `GET /shipment/:shipmentId/latest` -> latest shipment payment

## Smoke-test script (pre-deploy sequence)

Automated script:
- `npm run smoke:test`

What it validates:
1. Health endpoint
2. Register trader and staff users
3. Create shipment
4. Track shipment by tracking ID
5. Create payment
6. Create truck
7. Read dashboard, profile, payments, trucks

Environment for smoke script:
- `BACKEND_URL` (default `http://localhost:5000`)
- `SMOKE_PASSWORD` (optional)

## Response shape
All endpoints return:
- success: `{ success: true, data, message? }`
- error: `{ success: false, message, errors? }`
