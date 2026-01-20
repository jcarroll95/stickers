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

#### Acceptance criteria (per user story)

- Authentication and session
  - Given I provide a unique email, name, and valid password, when I POST to `/api/v1/auth/register`, then I receive a `200` with a token and a user in the response.
  - Given valid credentials, when I POST to `/api/v1/auth/login`, then I receive `200`, a HttpOnly cookie is set, and the body includes `{ success: true }`.
  - Given no token, when I GET `/api/v1/auth/me`, then I receive `401` and an error body.
  - Given an expired or invalid token, when I access any protected route, then I receive `401`.

- Create a stickerboard and place stickers
  - Given I am authenticated, when I POST `/api/v1/stickerboards` with `{ name, description }`, then I receive `201` and a Stickerboard object.
  - Given I am authenticated as the owner, when I POST `/api/v1/stickerboards/{boardId}/stix` with a valid stick payload, then I receive `201` and the stick belongs to `{boardId}`.
  - Given I am not authenticated, when I POST `/api/v1/stickerboards/{boardId}/stix`, then I receive `401`.
  - Given I am not the owner, when I PUT `/api/v1/stickerboards/{boardId}`, then I receive `403`.

- Log a dose and view adherence over time
  - Given I am authenticated, when I POST `/api/v1/doses` with required fields, then I receive `201` and the dose reflects my user as owner.
  - Given I am authenticated, when I GET `/api/v1/doses?from=...&to=...`, then I receive `200` and only my doses within range.
  - Given I am not the owner, when I DELETE `/api/v1/doses/{id}`, then I receive `403`.

- Log side effects and see trends
  - Given I am authenticated, when I POST `/api/v1/side-effects` with required fields, then I receive `201` and the side effect is linked to my user.
  - Given I am authenticated, when I GET `/api/v1/side-effects?effectType=nausea`, then I receive `200` and only the filtered results.

- Rewards and dashboard
  - Given I log consistently, when I request analytics `/api/v1/analytics/adherence?bucket=week`, then I receive `200` with streak and adherence percentage fields present.
  - Given I have side effect logs, when I GET `/api/v1/analytics/side-effects/trend?bucket=day`, then I receive `200` with a time series including `avgSeverity`.

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

Acceptance tests

```javascript
Feature: User authentication
  Scenario: Register a new user
    Given I have a unique email and valid password
    When I POST /api/v1/auth/register with { name, email, password }
    Then the response status is 200
    And the response has { success: true, token }

  Scenario: Login sets auth cookie
    Given an existing user with valid credentials
    When I POST /api/v1/auth/login
    Then the response status is 200
    And a HttpOnly cookie "token" is set
    And the body includes { success: true }

  Scenario: Protected route requires JWT
    When I GET /api/v1/auth/me without a token
    Then the response status is 401
    And the body matches the Error schema

  Scenario: Password reset flow
    Given I request a reset token
    When I PUT /api/v1/auth/resetPassword/{resettoken} with a valid new password
    Then the response status is 200
```

See also Postman collection: [../postman/](../postman)

#### Users (admin only, existing)
- GET `/api/v1/auth/users` — List users (admin)
- POST `/api/v1/auth/users` — Create user (admin)
- GET `/api/v1/auth/users/:id` — Get (admin)
- PUT `/api/v1/auth/users/:id` — Update (admin)
- DELETE `/api/v1/auth/users/:id` — Delete (admin)

Acceptance tests

```javascript
Feature: Admin users management
  Scenario: Only admin can list users
    Given I am authenticated as role "user"
    When I GET /api/v1/auth/users
    Then status is 403

  Scenario: Admin can list users
    Given I am authenticated as role "admin"
    When I GET /api/v1/auth/users
    Then status is 200 and body.data is an array of User

  Scenario: Admin can CRUD users
    Given I am authenticated as role "admin"
    When I POST /api/v1/auth/users with a valid user payload
    Then status is 201
    When I GET /api/v1/auth/users/{id}
    Then status is 200
    When I PUT /api/v1/auth/users/{id}
    Then status is 200
    When I DELETE /api/v1/auth/users/{id}
    Then status is 200
```

See also Postman collection: [../postman/](../postman)

#### Stickerboards (existing)
- GET `/api/v1/stickerboards` — List with `advancedResults` (supports population of `stix`)
- POST `/api/v1/stickerboards` (protected) — Create
    - Body: `{ name, description, tags?, photo? }`
- GET `/api/v1/stickerboards/:id` — Get by id
- PUT `/api/v1/stickerboards/:id` (protected) — Update
    - Body (extend for MVP): `{ name?, description?, layout? }` where `layout` is array of sticker states
- DELETE `/api/v1/stickerboards/:id` (protected) — Delete (cascades delete of stix via pre hook)
- PUT `/api/v1/stickerboards/:id/photo` (protected, role `vipuser`) — Upload board photo

Acceptance tests

```javascript
Feature: Stickerboards CRUD
  Scenario: Create board (authorized)
    Given I am authenticated as role "user"
    When I POST /api/v1/stickerboards with { name, description }
    Then status is 201 and body.data is a Stickerboard

  Scenario: Update board (owner only)
    Given I am authenticated but not the owner of the board
    When I PUT /api/v1/stickerboards/{id}
    Then status is 403

  Scenario: List supports pagination
    Given more than 20 boards exist
    When I GET /api/v1/stickerboards?page=2&limit=10&sort=name
    Then status is 200 and pagination is present

  Scenario: Upload board photo requires vipuser
    Given I am authenticated as role "user"
    When I PUT /api/v1/stickerboards/{id}/photo with a valid image
    Then status is 403

  Scenario: Photo upload validation
    Given I am authenticated as role "vipuser"
    When I upload a file larger than the maximum size or with an invalid mime type
    Then status is 400
```

See also Postman collection: [../postman/](../postman)

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

Acceptance tests

```javascript
Feature: Stix nested routes
  Scenario: List stix for a board
    When I GET /api/v1/stickerboards/{belongsToBoard}/stix
    Then status is 200 and each item.belongsToBoard == {belongsToBoard}

  Scenario: Add stick requires auth
    When I POST /api/v1/stickerboards/{belongsToBoard}/stix without a token
    Then status is 401

  Scenario: Update stick (owner only)
    Given I am authenticated but not the owner
    When I PUT /api/v1/stix/{stickId}
    Then status is 403

  Scenario: Batch upsert (optional)
    Given I am authenticated as the board owner
    When I POST /api/v1/stix/batch with a valid batch payload
    Then status is 200 and response indicates upserted count
```

See also Postman collection: [../postman/](../postman)

#### Comments (existing)
- Mounted under stickerboards: `/api/v1/stickerboards/:belongsToBoard/reviews` CRUD (already integrated). Optional for MVP; can keep minimal.

Acceptance tests

```javascript
Feature: Reviews access control
  Scenario: Create review as regular user
    Given I am authenticated as role "user"
    When I POST /api/v1/stickerboards/{boardId}/reviews { title, text, rating }
    Then status is 201

  Scenario: Update review requires author or role
    Given I am authenticated but not the review author
    When I PUT /api/v1/reviews/{id}
    Then status is 403

  Scenario: List reviews for a board
    When I GET /api/v1/stickerboards/{boardId}/reviews
    Then status is 200
```

See also Postman collection: [../postman/](../postman)

#### Doses (new)
- POST `/api/v1/doses` (protected)
    - Body: `{ medication, amount, unit, takenAt, notes?, stickerboardId? }`
    - 201 → `{ success: true, data: dose }`
- GET `/api/v1/doses` (protected)
    - Query: `from`, `to`, `page`, `limit`
    - 200 → `{ success: true, data: [dose], pagination: { page, limit, total, hasNext } }`
- DELETE `/api/v1/doses/:id` (protected, owner‑only)
    - 200 → `{ success: true }`

Acceptance tests

```javascript
Feature: Doses
  Scenario: Create dose (authorized)
    Given I am authenticated
    When I POST /api/v1/doses with { medication, amount, unit, takenAt }
    Then status is 201 and the dose owner is me

  Scenario: List doses (date range)
    Given I have multiple doses
    When I GET /api/v1/doses?from=2025-01-01&to=2025-02-01
    Then status is 200 and all items are within range

  Scenario: Delete dose (owner only)
    Given I am not the owner
    When I DELETE /api/v1/doses/{id}
    Then status is 403
```

See also Postman collection: [../postman/](../postman)

#### Side effects (new)
- POST `/api/v1/side-effects` (protected)
    - Body: `{ effectType, severity, occurredAt, notes?, linkedDoseId? }`
    - 201 → `{ success: true, data: sideEffect }`
- GET `/api/v1/side-effects` (protected)
    - Query: `from`, `to`, `effectType`, `page`, `limit`
    - 200 → `{ success: true, data: [sideEffect], pagination }`
- DELETE `/api/v1/side-effects/:id` (protected, owner‑only)

Acceptance tests

```javascript
Feature: Side effects
  Scenario: Create side effect (authorized)
    Given I am authenticated
    When I POST /api/v1/side-effects with { effectType, severity, occurredAt }
    Then status is 201 and the owner is me

  Scenario: List side effects (filter and paginate)
    Given I have multiple side effects
    When I GET /api/v1/side-effects?effectType=nausea&page=1&limit=10
    Then status is 200 and only items with effectType=nausea are returned

  Scenario: Delete side effect (owner only)
    Given I am not the owner
    When I DELETE /api/v1/side-effects/{id}
    Then status is 403
```

See also Postman collection: [../postman/](../postman)

#### Analytics (new)
- GET `/api/v1/analytics/adherence` (protected)
    - Query: `from`, `to`, `bucket=day|week`
    - 200 → `{ success: true, data: { streak: { current, best }, adherencePct, series: [ { date, taken } ] } }`
- GET `/api/v1/analytics/side-effects/trend` (protected)
    - Query: `from`, `to`, `bucket`
    - 200 → `{ success: true, data: [ { date, avgSeverity } ] }`

Acceptance tests

```javascript
Feature: Analytics
  Scenario: Adherence analytics
    Given I have logged doses across multiple days
    When I GET /api/v1/analytics/adherence?from=...&to=...&bucket=day
    Then status is 200 and data includes streak.current, streak.best, adherencePct, and series

  Scenario: Side-effects trend
    Given I have side effect logs
    When I GET /api/v1/analytics/side-effects/trend?from=...&to=...&bucket=week
    Then status is 200 and data is a time series of avgSeverity
```

See also Postman collection: [../postman/](../postman)

#### Errors and conventions
- Error shape (consistent): `{ success: false, error: { code, message, details? } }`
- Pagination via headers: `X-Total-Count`; body includes `pagination`.
- Security: all write/read of private resources require `protect` and ownership checks.

Security & robustness acceptance tests

```javascript
Feature: Security and resilience
  Scenario: Input sanitization
    When I attempt a NoSQL injection via query parameters
    Then the server responds safely (no injection executed) and returns 400 or 200 with sanitized query

  Scenario: XSS sanitization
    When I POST JSON containing HTML/JS in text fields
    Then the stored value is sanitized and responses do not reflect active scripts

  Scenario: Rate limiting
    Given I send more than 100 requests within 10 minutes from the same IP
    When I continue calling any endpoint
    Then I receive 429 Too Many Requests

  Scenario: CORS enforcement
    Given I call the API from an unapproved origin
    Then the browser enforces CORS and the request is blocked (preflight fails or response lacks CORS headers)
```

---

### Minimal JSON examples
- Create stickerboard
```http
POST /api/v1/stickerboards
Content-Type: application/json
```
```json
{ "name": "Week 1 Journey", "description": "My GLP-1 start week" }
```

- Batch save stix
```http
POST /api/v1/stix/batch
Content-Type: application/json
```
```json
{
  "belongsToBoard": "66f...",
  "items": [
    { "assetKey": "star-gold", "x": 128, "y": 96, "width": 64, "height": 64, "rotation": 0, "zIndex": 1 }
  ]
}
```

- Log dose
```http
POST /api/v1/doses
Content-Type: application/json
```
```json
{ "medication": "semaglutide", "amount": 0.25, "unit": "mg", "takenAt": "2025-12-20T14:00:00Z" }
```

- Log side effect
```http
POST /api/v1/side-effects
Content-Type: application/json
```
```json
{ "effectType": "nausea", "severity": 3, "occurredAt": "2025-12-20T18:30:00Z", "notes": "mild in evening" }
```
---