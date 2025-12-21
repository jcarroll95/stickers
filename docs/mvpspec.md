### MVP product spec (v1)

#### Problem and goal
GLP‑1 users face wide-ranging side effects, infrequent doses, routinely changing doses, and other issues that can create a challenging treatment experience. 
The MVP helps them: (1) record doses and side effects quickly, (2) gain insight into how dosing behaviors affect their experience and (3) stay engaged with a playful sticker board.

#### Primary personas
- Patient user: wants quick logging, encouragement, and lightweight insights.
- Administrator: wants to see clean architecture, security, tests, and thoughtful UX in a small but complete system.

#### Core user stories (MVP)
- As a user, I can register, log in, and stay authenticated using secure cookies.
- I can create a stickerboard and place stickers to personalize progress.
- I can log a dose (medication, amount, time) and see adherence over time.
- I can log side effects (type, severity, notes) and see simple trends.
- I receive fun stickers as rewards for adherence streaks or consistent logging.
- I can view a dashboard with basic charts: adherence percentage, symptom trend.

#### Out of scope (v1)
- Social graph and following friends, comments beyond simple board reviews.
- Notifications/Reminders (push/email/SMS).
- Complex analytics or clinician‑facing views.

#### Success metrics for MVP
- Task completion: new user can register → create board → log dose → place a sticker → see a chart in under 3 minutes.
- Engineering quality: CI runs tests and deploys both frontend and backend on main; Lighthouse desktop score ≥ 85; backend lint/tests pass.

#### Non‑functional requirements
- Security: JWT in HttpOnly cookies, CORS limited to frontend domain, rate‑limited endpoints, input sanitization (already present server‑side).
- Performance: API p95 < 300ms with seeded data; frontend bundle modest and code‑split.
- Reliability: autosave stickerboard changes; API validation and meaningful errors.

#### Data model snapshot (MVP)
- User: auth profile; roles: `user`, `admin`.
- Stickerboard: name, slug, description, user owner, createdAt, tags, photo, layout/derived fields.
- Stick: belongsToBoard, assetKey, x, y, width, height, rotation, zIndex, metadata.
- Dose (new): user, medication (enum/string), amount, unit, takenAt, notes, optional stickerboardId.
- SideEffectLog (new): user, effectType, severity (1–5), notes, occurredAt, optional linkedDoseId.

---

### REST API endpoint list (MVP)
Note: v1.0.0 endpoints included first followed by proposed additions for doses, side effects, and analytics. All protected routes require a valid JWT in an HttpOnly cookie.

#### Auth (existing)
- POST `/api/v1/auth/register` — Register
    - Body: `{ email, password, name }`
    - 201 → `{ success: true, data: { user } }`
- POST `/api/v1/auth/login` — Login
    - Body: `{ email, password }`
    - 200 sets cookie + `{ success: true, data: { user } }`
- GET `/api/v1/auth/me` — Current user (protected)
- POST `/api/v1/auth/forgotPassword` — Initiate reset
- PUT `/api/v1/auth/resetPassword/:resettoken` — Complete reset
- PUT `/api/v1/auth/updatedetails` (protected)
- PUT `/api/v1/auth/updatepassword` (protected)
- GET `/api/v1/auth/logout` — Clears cookie

#### Users (admin only, existing)
- GET `/api/v1/auth/users` — List users (admin)
- POST `/api/v1/auth/users` — Create user (admin)
- GET `/api/v1/auth/users/:id` — Get (admin)
- PUT `/api/v1/auth/users/:id` — Update (admin)
- DELETE `/api/v1/auth/users/:id` — Delete (admin)

#### Stickerboards (existing)
- GET `/api/v1/stickerboards` — List with `advancedResults` (supports population of `stix`)
- POST `/api/v1/stickerboards` (protected) — Create
    - Body: `{ name, description, tags?, photo? }`
- GET `/api/v1/stickerboards/:id` — Get by id
- PUT `/api/v1/stickerboards/:id` (protected) — Update
    - Body (extend for MVP): `{ name?, description?, layout? }` where `layout` is array of sticker states
- DELETE `/api/v1/stickerboards/:id` (protected) — Delete (cascades delete of stix via pre hook)
- PUT `/api/v1/stickerboards/:id/photo` (protected, role `vipuser`) — Upload board photo

Nested routers under `stickerboards`:
- Stix (mounted at `/:belongsToBoard/stix`)
- Reviews (mounted at `/:belongsToBoard/reviews`)

#### Stix (existing)
- GET `/api/v1/stix` — List all stix (supports populate of `stickerboard`)
- POST `/api/v1/stix` (protected) — Add a stick (expects `belongsToBoard` in body)
- POST `/api/v1/stix/:belongsToBoard` (protected) — Add stick to board by path param
- GET `/api/v1/stix/:stickId` — Get a specific stick
- PUT `/api/v1/stix/:stickId` (protected) — Update a specific stick

Recommended small additions for MVP persistence convenience:
- POST `/api/v1/stix/batch` (protected) — Bulk upsert stix for a board
    - Body: `{ belongsToBoard, items: [ { id?, assetKey, x, y, width, height, rotation, zIndex, ... } ] }`
    - 200 → `{ success: true, data: { upserted: n } }`

#### Reviews (existing)
- Mounted under stickerboards: `/api/v1/stickerboards/:belongsToBoard/reviews` CRUD (already integrated). Optional for MVP; can keep minimal.

#### Doses (new)
- POST `/api/v1/doses` (protected)
    - Body: `{ medication, amount, unit, takenAt, notes?, stickerboardId? }`
    - 201 → `{ success: true, data: dose }`
- GET `/api/v1/doses` (protected)
    - Query: `from`, `to`, `page`, `limit`
    - 200 → `{ success: true, data: [dose], pagination: { page, limit, total, hasNext } }`
- DELETE `/api/v1/doses/:id` (protected, owner‑only)
    - 200 → `{ success: true }`

#### Side effects (new)
- POST `/api/v1/side-effects` (protected)
    - Body: `{ effectType, severity, occurredAt, notes?, linkedDoseId? }`
    - 201 → `{ success: true, data: sideEffect }`
- GET `/api/v1/side-effects` (protected)
    - Query: `from`, `to`, `effectType`, `page`, `limit`
    - 200 → `{ success: true, data: [sideEffect], pagination }`
- DELETE `/api/v1/side-effects/:id` (protected, owner‑only)

#### Analytics (new)
- GET `/api/v1/analytics/adherence` (protected)
    - Query: `from`, `to`, `bucket=day|week`
    - 200 → `{ success: true, data: { streak: { current, best }, adherencePct, series: [ { date, taken } ] } }`
- GET `/api/v1/analytics/side-effects/trend` (protected)
    - Query: `from`, `to`, `bucket`
    - 200 → `{ success: true, data: [ { date, avgSeverity } ] }`

#### Errors and conventions
- Error shape (consistent): `{ success: false, error: { code, message, details? } }`
- Pagination via headers: `X-Total-Count`; body includes `pagination`.
- Security: all write/read of private resources require `protect` and ownership checks.

---

### Minimal JSON examples
- Create stickerboard
```json
POST /api/v1/stickerboards
{
  "name": "Week 1 Journey",
  "description": "My GLP-1 start week"
}
```
- Batch save stix
```json
POST /api/v1/stix/batch
{
  "belongsToBoard": "66f...",
  "items": [
    { "assetKey": "star-gold", "x": 128, "y": 96, "width": 64, "height": 64, "rotation": 0, "zIndex": 1 }
  ]
}
```
- Log dose
```json
POST /api/v1/doses
{ "medication": "semaglutide", "amount": 0.25, "unit": "mg", "takenAt": "2025-12-20T14:00:00Z" }
```
- Log side effect
```json
POST /api/v1/side-effects
{ "effectType": "nausea", "severity": 3, "occurredAt": "2025-12-20T18:30:00Z", "notes": "mild in evening" }
```
---