[![CI](https://github.com/jcarroll95/stickers/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jcarroll95/stickers/actions/workflows/ci.yml)
[![Deploy (PM2)](https://github.com/jcarroll95/stickers/actions/workflows/deploy-pm2.yml/badge.svg)](https://github.com/jcarroll95/stickers/actions/workflows/deploy-pm2.yml)

# Stickerboards

A production-deployed social “stickerboard” designed for GLP-1 users to stay consistent with dosing logs, track trends, and maintain motivation through a playful reward loop.

**Live:** https://www.stickerboards.app
**MVP spec:** [`/docs/mvpspec.md`](./docs/mvpspec.md)
**Postman collection:** [`/postman`](./postman)

---

# System Overview

Stickerboards is a full-stack monorepo application built to explore:

- Idempotent transactional reward systems
- Secure JWT-based auth with RBAC
- Image-heavy UI performance optimization
- Auditability of administrative actions
- Production deployment with observability and backups

The system is intentionally designed beyond CRUD patterns, with strong emphasis on correctness, traceability, and operational discipline.

---

# Architecture

## Monorepo Structure

Organized as an **npm workspaces monorepo**:
-apps/
--api/ -> Node.js + Express REST API
--web/ -> React + Vite SPA


This enables:
- Shared CI/CD pipelines
- Clear frontend/backend boundaries
- Independent dependency scopes
- Deterministic production installs

---

## Architectural Style

Stickerboards currently follows a **Domain-Oriented Layered Architecture**.

It has moved beyond MVC by isolating business logic in `usecases`, but it does not yet fully implement strict Hexagonal Architecture.

### Current Structure

- **Controllers** → HTTP transport layer
- **Usecases** → Core business logic
- **Models (Mongoose)** → Persistence layer
- **Middleware** → Cross-cutting concerns

### Tradeoff: Hexagonal vs Pragmatic Layering

A strict Hexagonal implementation would:

- Use Ports/Interfaces between usecases and persistence
- Use plain domain entities decoupled from Mongoose
- Eliminate infrastructure imports (e.g., `fs`, Mongoose models) from usecases

Current tradeoff:

- Usecases occasionally import Mongoose models directly
- Some domain lifecycle logic lives in Mongoose hooks
- This reduces abstraction overhead and improves iteration speed
- At the cost of full infrastructure decoupling

This decision was made to balance architectural rigor with solo-project velocity while still maintaining testable service boundaries.

A future refactor could introduce repository ports without breaking existing controllers.

---

# Core Engineering Challenges Solved

## 1. Idempotent Sticker Transactions

Awarding and revoking stickers are:

- Keyed by `opId`
- Guarded against double-processing
- Wrapped in MongoDB transactions where appropriate

This ensures correctness under:
- Network retries
- Double-click submissions
- Race conditions

Tradeoff:
- Relies on MongoDB transactional semantics rather than an event-sourced ledger.
- Chosen for implementation simplicity and operational clarity.

---

## 2. Transactional Asset Ingestion

Sticker pack ingestion:

- Validates uniqueness constraints
- Ensures atomic writes
- Prevents duplicate ingestion via transaction boundaries

Tradeoff:
- Uses Mongo transactions instead of asynchronous job queues.
- Simpler operational model for current scale.

---

## 3. Audit Logging

All sensitive operations emit structured audit events:

- Admin inventory changes
- Sticker awards/revocations
- Pack mutations

Audit events provide:
- Traceability
- Operational forensics
- Administrative transparency

Tradeoff:
- Centralized event logging rather than external event stream.
- Simpler infrastructure footprint.

---

## 4. RBAC via JWT Payload

Authentication uses:

- JWTs stored in HttpOnly cookies
- Role-based claims embedded in JWT payload
- Middleware-based authorization checks

Frontend listens for `auth:unauthorized` broadcast events to gracefully handle session expiry.

Tradeoff:
- JWT-based RBAC over server-side sessions.
- Chosen for statelessness and deployment simplicity.

---

## 5. Image Optimization Pipeline

The frontend includes a dedicated ingestion pipeline:

- `sharp` for image processing
- Multi-width generation (400w, 800w, 1200w)
- Multi-format output (WebP + PNG)
- `vite-plugin-image-optimizer` for build-time compression

Tradeoff:
- Build-time optimization instead of dynamic CDN transformation.
- Reduces infrastructure complexity at current scale.

---

# Security & Hardening

- Global rate limiting
- Registration cooldowns
- Account lockout mechanisms
- XSS sanitization middleware
- Mongo query sanitization
- HttpOnly secure cookies
- No root deployment user
- Environment variable isolation per release

Tradeoff:
- Security hardening applied at application level rather than WAF layer.
- Appropriate for VPS-hosted solo deployment.

---

# Observability & Operations

## Monitoring

- **Grafana + Loki** for log aggregation
- Alert rules (e.g., 5 errors in 5 minutes)
- Structured logs for operational clarity
- Rolling file logs accessible via admin dashboard

## Error Tracking

- **Sentry integration (in progress)** for exception aggregation and stack trace analysis.

## Backups

- Weekly full server backups
- Daily MongoDB backups to DigitalOcean Spaces (object storage)

## Deployment

- Artifact-based CI/CD via GitHub Actions
- Immutable release directories
- Atomic symlink cutover
- PM2 process management
- Non-root application user

Tradeoff:
- VPS-based deployment instead of managed PaaS.
- Chosen for deeper infrastructure exposure and learning value.

---

# Testing Strategy

## Unit Tests

- Business logic in `usecases`
- Transactional correctness validation
- Audit event emission verification

## Integration Tests

- API route testing against test database
- Auth flow validation
- Idempotency enforcement

## End-to-End Tests

- Playwright-based browser tests
- Auth flows
- Core sticker interactions
- Regression prevention

Tradeoff:
- Focused coverage on high-risk transaction paths
- Not 100% coverage, but strategic coverage on invariants

---

# Project Structure

.
├── apps/
│ ├── api/
│ │ ├── controllers/
│ │ ├── middleware/
│ │ ├── models/
│ │ ├── usecases/
│ │ └── server.js
│ └── web/
│ ├── src/
│ │ ├── components/
│ │ ├── store/
│ │ └── services/
│ └── optimize-images.js
├── docs/
├── scripts/
└── package.json


---

# Local Development

## Prerequisites

- Node.js >= 18
- MongoDB

## Setup

```bash
npm install
npm run dev
npm test
```

## Manual image optimization
```bash
npm run optimize-images -w stickerboards-web
```

## License: MIT
