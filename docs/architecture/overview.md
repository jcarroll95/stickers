# Architecture Overview

Stickerboards is a production-deployed full-stack web application built as an npm workspaces monorepo. The system is structured as a Domain-Oriented Layered Architecture with clearly defined transport, application, and persistence layers.

This document provides a high-level overview of request flow, major components, and system invariants.

---

## 1. High-Level System Diagram
Client (React SPA)
↓
Express API (Controllers + Middleware)
↓
Usecases (Application Layer / Business Logic)
↓
Persistence (Mongoose Models / MongoDB)
↓
Infrastructure (Logging, Backups, Monitoring)

Supporting Systems:
- Grafana + Loki (log aggregation + alerting)
- PM2 (process management)
- GitHub Actions (CI/CD)
- DigitalOcean Spaces (database backups)
- Sentry (error aggregation, in progress)

---

## 2. Request Flow

### A. Authenticated API Request
1. User interacts with the React SPA.
2. SPA sends HTTP request via Axios client.
3. JWT (stored in HttpOnly cookie) is automatically attached.
4. Express middleware:
  - Parses JWT
  - Validates signature
  - Extracts role claims (RBAC)
  - Applies rate limiting
5. Controller:
  - Validates input
  - Delegates to a usecase
6. Usecase:
  - Enforces business invariants
  - Executes MongoDB transaction (if required)
  - Emits audit event
7. Persistence layer (Mongoose):
  - Performs writes/reads
  - Enforces schema validation
8. Structured log emitted.
9. Response returned to client.

Frontend listens for `auth:unauthorized` events to gracefully handle expired sessions.

---

### B. Sticker Award Transaction (Critical Path)
Awarding a sticker:

- Requires authenticated user
- Must be idempotent (`opId`)
- Must not double-consume inventory
- Must emit audit event
- Must commit atomically

Flow:

Controller → `awardStickerUsecase(opId, userId, stickerId)`
→ Begin Mongo transaction
→ Validate inventory
→ Apply mutation
→ Record transaction marker
→ Emit audit event
→ Commit

If retried with same `opId`, the usecase returns safely without duplicate mutation.

---

## 3. Major Components

### apps/web (Frontend)
- React + Vite SPA
- Konva-based sticker board rendering
- Zustand state management
- Axios API client with interceptors
- Build-time image optimization pipeline (sharp)

Responsibilities:
- Presentation logic
- Client state
- Session UX handling
- Performance-optimized asset delivery

---

### apps/api (Backend)

#### Controllers
HTTP transport layer. No business logic.

#### Middleware
- JWT verification
- RBAC enforcement
- Rate limiting
- XSS and Mongo query sanitization
- Structured logging

#### Usecases
Application layer containing business logic:
- Sticker transactions
- Inventory mutations
- Asset ingestion
- Audit emission

Enforces:
- Idempotency
- Transactional correctness
- Authorization checks
- Domain invariants

#### Models (Persistence)
Mongoose schemas and database adapters.

Note:
Models are currently infrastructure-coupled and imported directly into usecases. This is a pragmatic layering choice rather than strict hexagonal architecture.

---

## 4. Key Invariants

The system is designed around several non-negotiable invariants:

### 1. Idempotency
All sticker award/revoke operations:
- Require unique `opId`
- Must not double-apply state mutations

### 2. Atomic Mutations
Multi-step operations:
- Execute within MongoDB transactions
- Must either fully succeed or fully rollback

### 3. Auditability
All administrative and inventory mutations:
- Emit structured audit events
- Must be reconstructable post hoc

### 4. Authorization Integrity
All privileged operations:
- Require validated JWT
- Must enforce RBAC from token claims
- Must not rely on client-provided role flags

### 5. Sanitized Inputs
All incoming data:
- Must pass sanitization middleware
- Must not allow operator injection into Mongo queries
- Must not allow reflected XSS

---

## 5. Observability & Operations

### Logging
- Structured logs emitted at API layer
- Aggregated in Loki
- Visualized in Grafana
- Alert rules (e.g., 5 errors in 5 minutes)

### Backups
- Daily MongoDB backups to DigitalOcean Spaces
- Weekly full server backups

### Deployment
- CI builds artifacts
- Release extracted to versioned directory
- Atomic symlink switch
- PM2 reload with zero-downtime strategy

---

## 6. Architectural Tradeoffs

This project intentionally balances rigor with pragmatic velocity.

Not yet implemented:
- Strict repository ports between usecases and persistence
- Pure domain entities decoupled from Mongoose
- Event-sourced ledger for reward system

Current design favors:
- Strong transactional guarantees
- Clear service-layer isolation
- Operational simplicity
- Explicit invariants over theoretical purity

---

## 7. Related Documentation

- MVP Specification: `/docs/mvpspec.md`
- API Collection: `/postman`
- CI/CD Workflows: `.github/workflows`
- (Future) Component Diagram: `/docs/architecture/component-diagram.md`
- (Future) Sequence Diagrams: `/docs/architecture/sequence-award-sticker.md`
