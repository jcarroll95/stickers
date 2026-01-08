# Architecture

## System overview

Stickerboards is a full-stack web application with a simple, effective structure:

- **Client:** React + Vite (served as static assets)
- **API:** Node.js + Express (REST API)
- **Database:** MongoDB via Mongoose ODM
- **Static assets:** `client/dist` served by Nginx
- **CI/CD:** GitHub Actions runs tests/coverage on all pushes and PRs; a deploy workflow ships `main` to a server via SSH and runs the API under PM2.

At a high level, the system is split into two runtime concerns:

1. **Frontend static serving** (Nginx serves `client/dist` to users)
2. **API runtime** (PM2 manages a Node process running Express)

Why these choices? 
- **Accessibility:** I wanted to rapidly prototype and scaffold this project without a deep well of modern web dev experience to draw on, so I made choices that are well-supported with resources and tutorials
- **Front End:** React + Vite was selected for rapid UI iteration and a strong ecosystem; an SSR framework like Next.js would be a better fit if SEO, first-load performance, or server-rendered pages become primary requirements.
- **Back End:** Node.js for REST API a project objective. Express was chosen for simplicity and low operational overhead; in a larger team or more complex domain, NestJS or a TypeScript-first approach can improve maintainability and enforce architectural consistency.
- **Database:**  MongoDB was selected for rapid iteration and a document-oriented model; if the domain evolves toward more relational data and strict integrity requirements, PostgreSQL becomes the stronger default.
- **Web Server:** NGINX was chosen to efficiently serve static assets and provide a stable reverse proxy; alternatives like Caddy simplify TLS, and managed edge services can reduce operational burden if scaling becomes a priority.
- **Process Management:** PM2 provides straightforward process supervision on a single VM; systemd is a strong alternative for tighter OS integration, and containers become attractive when reproducibility across environments is a priority.
- **CI/CD:** GitHub Actions provides reliable automation within the repository workflow; alternative CI systems are viable, but Actions offers the best ROI given the project’s GitHub-centric development.

### Request routing topology

- Browser loads the SPA from Nginx.
- The SPA calls the API at `/api/v1/*`.
- Express handles API routes; Nginx is responsible for static assets and reverse proxying.

---

## Runtime configuration

The service is configured via environment variables in `config/config.env`, including:

- **Environment:** `NODE_ENV`
- **API Port:** `PORT`
- **Database URI:** `MONGO_URI`
- **Auth:** `JWT_SECRET`, `JWT_EXPIRE`, `JWT_COOKIE_EXPIRE`
- **Email:** `SMTP_*`, `FROM_EMAIL`, `FROM_NAME`
- **CORS:** `CLIENT_URL`

---

## Core domain model

### Stickerboard

- A `Stickerboard` belongs to a `User` via `user: ObjectId`.
- `name` is unique **per user**, enforced by a compound unique index `{ user: 1, name: 1 }`.
- Sticker placements are stored as an **embedded array** `stickers[]`, each with schema-level validation (bounds, defaults) to protect data integrity.
- `Stickerboard` reverse-populates related resources via virtual fields:
    - `stix` (referencing `Stick.belongsToBoard`)
    - `comments` (referencing `Comment.belongsToBoard`)

Cascade delete is implemented in a `pre('deleteOne')` hook: deleting a stickerboard deletes its associated sticks and comments.

### Stick

A `Stick` represents a dose/log entry associated with a stickerboard and a user:

- References:
    - `belongsToBoard: ObjectId -> Stickerboard`
    - `user: ObjectId -> User`
- Derived metrics:
    - Updates `Stickerboard.averageCost` via aggregation on save and delete hooks.

### Comment

A `Comment` represents a motivational comment under a stickerboard, from a non-owner.

- References:
    - `belongsToBoard: ObjectId -> Stickerboard`
    - `belongsToUser: ObjectId -> User`
- Invariants:
    - A compound unique index on `{ belongsToBoard, belongsToUser }` enforces **one comment per user per board**.
- Derived metrics:
    - Updates `Stickerboard.averageRating` via aggregation on save and delete hooks.

---

## Key flows

### Flow 1: Registration and verification (public)

1. `POST /api/v1/auth/register-start`
    - Normalizes email, validates basic email/password format.
    - Creates user (unverified) if needed.
    - Implements resend cooldown to reduce email spam and abuse.
    - Sends an email verification code (expires in 15 minutes).

2. `POST /api/v1/auth/register-verify`
    - Checks email + verification code.
    - Enforces lockout after too many attempts.
    - On success, sets `isVerified=true` and issues a JWT.

---

### Flow 2: Login and session

- `POST /api/v1/auth/login`:
    - Validates email/password.
    - Requires `user.isVerified === true`.
    - Issues JWT and sets an HttpOnly cookie.

Tokens are supported via:
- `Authorization: Bearer <token>` header OR
- `cookie: token=<jwt>`

Cookie options include:
- `httpOnly: true`
- `sameSite: 'lax'`
- `secure: true` in production

---

### Flow 3: Stickerboard updates

`PUT /api/v1/stickerboards/:id` has two distinct update classes:

#### A) Owner/Admin updates

Owners and admins can update limited board fields using an allowlist:
- `name`, `description`, `tags`, `photo`, `stickers`

**Reasoning:** Avoid arbitrary `req.body` merges that allow privilege escalation or unintended field writes.

#### B) Non-owner “Cheers!” append (consumable sticker)

Non-owners are only permitted to perform a constrained update:
- The request body must contain **only** one key: `stickers` (array) or `sticker` (object).
- If `stickers` array is provided, it must be strictly longer than the current board stickers (append-only semantic).
- The server ignores arbitrary client-supplied sticker shapes and constructs a validated sticker object via `buildCheersSticker()`.

**Atomicity strategy:**
- The system consumes the sticker from `User.cheersStickers` first using a conditional update (`$pull` with a match on `cheersStickers`).
- Only if consumption succeeds does it append the sticker placement to the stickerboard with `$push`.

A Mongoose session/transaction is attempted; on environments without replica set transaction support, it falls back to non-transactional writes.

**Tradeoffs:**
- Conditional consume-first prevents “double spend” under concurrency even without full transactions.
- Without transactions, a crash between consume and append could “burn” a sticker; this is mitigated by using a transaction when available and can be further improved (see below).

**Alternatives (if scaling or hardening further):**
- Always require transactions by running MongoDB as a replica set everywhere (dev/test/prod).
- Add idempotency keys on “cheers” requests.
- Record cheers events in an append-only collection and reconcile consumption asynchronously.
- Use a “pending consumption” state to allow safe compensation on failure.

---

### Flow 4: Adding a stick (dose log)

`POST /api/v1/stix/:belongsToBoard` creates a `Stick` and also updates the stickerboard’s sticker palette:

- Uses a field allowlist for stick creation.
- Uses a session/transaction when available.
- Adds a deterministic “palette sticker” derived from `stickNumber % 10` (or a fallback algorithm if stickNumber is absent).

**Tradeoffs:**
- Bundling the “stick entry” and “sticker palette update” in one flow keeps UX consistent (a new stick implies a new sticker is available).
- It increases coupling between stick creation and stickerboard rendering; future refactors might separate these concerns.

---

## Querying, filtering, and pagination

The API includes an `advancedResults` middleware intended to provide:
- filtering, sorting, field selection, pagination
- optional population

---

## Operational notes

### Error handling
Errors are normalized by a centralized middleware:
- CastError -> 404
- Duplicate key -> 400 with special-case messaging for comment uniqueness
- ValidationError -> 400

### Static assets
- Express serves `public/` statically.
- Uploads are written to `FILE_UPLOAD_PATH` and filename is normalized per board ID.

---

## Known limitations and improvement roadmap

- **CSRF posture:** Cookies are HttpOnly and sameSite=lax; CSRF protections are not comprehensive beyond sameSite and CORS assumptions.
- **Observability:** Current logging is mostly console-based; add structured logs and request correlation IDs for production operations.
- **Generic querying:** Parameterize `advancedResults` search fields and cap pagination limits to prevent abuse.
- **Transaction enforcement:** Consider standardizing on replica set everywhere to remove fallback complexity and guarantee multi-write atomicity.
- **Document growth:** Embedded `stickers[]` may grow unbounded over time; consider extracting sticker placements to a separate collection if growth becomes significant.
