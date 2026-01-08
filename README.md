[![CI](https://github.com/jcarroll95/stickers/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jcarroll95/stickers/actions/workflows/ci.yml)
[![Deploy (PM2)](https://github.com/jcarroll95/stickers/actions/workflows/deploy-pm2.yml/badge.svg)](https://github.com/jcarroll95/stickers/actions/workflows/deploy-pm2.yml)

# Stickerboards

A lightweight social “stickerboard” that helps GLP-1 users stay consistent with dosing logs, track trends, and keep motivation through a playful reward loop.

**Live:** https://www.stickerboards.app  
**MVP spec:** [`/docs/mvpspec.md`](./docs/mvpspec.md)  
**Postman collection:** [`/postman`](./postman)

---

## Table of contents

- [Problem](#problem)
- [Technical approach](#technical-approach)
    - [Architecture overview](#architecture-overview)
    - [Key design decisions](#key-design-decisions)
- [Project structure](#project-structure)
- [Security considerations](#security-considerations)
- [MVP status](#mvp-status)
- [Next version features](#next-version-features)
- [Scaling plan](#scaling-plan)
- [Local development](#local-development)
- [License](#license)

---

## Problem

GLP-1 users take medicine in weekly doses which can make logging and tracking doses and side effects challenging. This project’s MVP focuses on:

1. **Fast logging** of doses and symptoms (“stix”)
2. **Trend visibility** (what side effects show up, when, and what helped)
3. **Engagement** through a pseudo-social stickerboard: users earn/place stickers and can send supportive comments or “cheers” stickers to others (anonymous)

The full scope and acceptance criteria are captured in the MVP spec: [`/docs/mvpspec.md`](./docs/mvpspec.md).

---

## Technical approach

### Architecture overview

- **Frontend:** React + Vite SPA
- **Backend:** Node.js + Express REST API
- **Database:** MongoDB (Mongoose ODM)
- **Auth:** JWT issued by the API; stored as an HttpOnly cookie (`sameSite=lax`, `secure` in production) with Bearer-token support for API clients/tests
- **Infra:** GitHub Actions for CI (tests + coverage artifact) and CD (SSH deploy). Nginx serves the built client; PM2 runs the API process.

At runtime, the system is split intentionally:
- Nginx serves `client/dist` (static SPA build)
- Express serves `/api/v1/*` and also exposes `/public` for uploaded assets

### Key design decisions

**1) “Cheers” stickers are a consumable resource**  
Non-owners can cheer another user’s board by placing a special sticker. Those stickers are stored as an inventory array on the user. The update logic is designed to prevent double-spend under concurrency by using a consume-first conditional update (and transactions when available).

**2) Sticker placements are embedded on the Stickerboard document**  
Sticker placements are stored as an embedded array for fast board reads and simple rendering (fetch one document → render). The tradeoff is document growth; if sticker volume becomes large, placements can be extracted to a dedicated collection.

**3) Integrity rules are enforced at the database layer where possible**  
Assorted invariants are enforced with indexes (e.g., one comment per user per board, and stickerboard name uniqueness per user).

**4) Tests prioritize incident prevention, not just coverage**  
The test harness uses mongodb-memory-server with safety checks to avoid accidental non-local data deletion, mocks email sending, and focuses on authorization and invariants.

---

## Project structure

A map of the most relevant directories/files:

```text
.
├── server.js                   # Express app setup, security middleware, route mounting
├── config/
│   ├── db.js                   # DB connect (skipped during tests)
│   └── config.env.env          # Example env var names (sanitized)
├── controllers/
│   ├── auth.js                 # login + verification flow, JWT cookie issuance
│   ├── stickerboard.js         # board CRUD + cheers update invariants
│   ├── stick.js                # stix CRUD + derived sticker addition
│   ├── comments.js             # comments CRUD + per-user uniqueness
│   └── users.js                # user management logic
├── docs/                       # MVP Spec, architecture document, etc
├── middleware/
│   ├── async.js                # async wrapper
│   ├── auth.js                 # protect + authorize routes with JWT
│   ├── advancedResults.js      # pagination/filter/sort middleware
│   ├── performance.js          # first draft API performance metrics
│   └── error.js                # centralized error shaping
├── models/                     # MongoDB Schemas
├── routes/                     # Express routes
├── test/
│   ├── jest.setup.js           # mongodb-memory-server + global mocks
│   └── setupEnv.js             # test env setup (if present)
├── __tests__/                  # Jest tests (Supertest integration/invariants)
├── utils/
│   ├── errorResponse.js        # error handler wrapper
│   └── sendEmail.js            # verification email sending utility
├── e2e/                        # Playwright tests
├── client/                     # React/Vite frontend
└── .github/workflows/          # CI and deployment workflows
```

### Security considerations

This is a portfolio project, but it intentionally uses production-shaped controls:

- JWT in HttpOnly cookie to reduce token theft via XSS (with secure in production and sameSite=lax)
- Route protection and role checks via middleware (protect, authorize)
- Registration hardening:
    - verification flow with resend cooldown
    - lockout after repeated invalid verification attempts
    - per-route rate limiting on registration endpoints
- Input hardening:
    - XSS sanitizer
    - mongo query sanitization
- HPP protection
- Helmet

Known security gaps / next hardening steps:
- CSRF strategy beyond sameSite if cookie auth is used for all mutating requests in more complex deployment topologies
- structured logging + sensitive-data redaction for production
- stronger file validation (signature checks, object storage, malware scanning in higher-risk settings)

## MVP status: 

Backend: v1.0.0 API is implemented, tested, documented, and deployed.
Frontend: deployed and functional against the API.

### MVP flow coverage includes:

Register → verify email → login
Create a board
Log sticks (“stix”) with dose + notes
Place stickers on your board
Comment on other boards
Send “cheers” stickers to other boards (consumable inventory model)

## GitHub Actions for CI/CD

### CI runs on every push/PR and publishes a coverage artifact:
CI workflow

### Deployment is automated on main:
Deploy workflow

## Next version features

### Short list of the next meaningful additions (beyond MVP):
- Analytics/trends view for side effects (time-to-onset, duration, mitigations)
- Progress photos / measurements (opt-in, privacy controls)
- Improved board discovery (filters, search, pagination caps)

### VIP insights:
- Integrate LLM-backed summarization of a user’s stix logs
- trend highlights with clear limitations and safety disclaimers
- RAG over user-owned logs (no cross-user leakage)

## Scaling plan

If this product grew beyond a single-node deployment, the next steps would be:

1) Data and query scaling
Cap pagination limits and parameterize search fields in generic query middleware
Add/verify indexes on common access paths (board lookups, comments by board, stix by board)
Consider extracting sticker placements to a separate collection if boards grow large
Introduce caching for hot board reads (or precomputed snapshots)

2) Reliability and operations
Move from console logs to structured logs with correlation IDs
Add health checks and basic metrics dashboards (latency, error rate, DB ops)
Artifact-based deploys (build in CI, deploy artifacts) for safer rollback and less server drift

3) Security hardening
Add explicit CSRF protection if cookie auth is the dominant mechanism
Tighten upload handling (signature checks, object storage, scanning where appropriate)
Token rotation / refresh strategy if session security requirements increase


### License
[MIT](LICENSE)


