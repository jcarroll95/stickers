# Security Policy

This document describes the security approach for Stickerboards and how to report vulnerabilities.

## Reporting a Vulnerability

If you believe you’ve found a security issue, please report it privately.

- Preferred: open a GitHub Security Advisory (Repository → Security → Advisories)
- Alternative: open a GitHub issue **without** sensitive details and request a private channel

Please include:
- Impact summary and affected endpoint(s)
- Steps to reproduce (PoC if possible)
- Any logs or screenshots that help confirm the issue

## Scope

In scope:
- Authentication / authorization bypass
- Session theft, CSRF, XSS, injection issues
- Data exposure (PII, tokens, secrets)
- Privilege escalation (RBAC)
- Transaction integrity issues (idempotency bypass, double-spend)

Out of scope:
- Denial-of-service via high-volume traffic (no bug bounty / no paid testing infrastructure)
- Social engineering

## Security Controls

### Authentication & Session Handling
- JWT authentication stored in **HttpOnly cookies** to reduce XSS token theft risk.
- Tokens are verified server-side on every authenticated request.
- Session expiry is handled gracefully client-side (unauthorized broadcast event).

Tradeoff:
- Stateless JWT sessions vs server-side session store. JWT chosen for operational simplicity.

### Authorization (RBAC)
- Role claims are embedded in the JWT payload and enforced by API middleware.
- Admin-only endpoints require explicit role checks server-side.
- Clients never supply roles/permissions; only the server-issued token is trusted.

### Request Hardening
- Rate limiting on sensitive endpoints.
- Registration cooldowns and lockout mechanisms to reduce brute-force attempts.
- Centralized error handling to avoid leaking stack traces in production responses.

### Input Sanitization
- XSS sanitization applied globally for user-provided text fields.
- MongoDB query/operator injection protection applied globally (e.g., blocking `$` operators in user input).
- Server validates input shape and required fields at boundary (controllers / middleware).

### Data Integrity
- Idempotent mutation operations use `opId` keys to prevent double-processing under retries.
- Multi-step mutations use MongoDB transactions to ensure atomicity and rollback safety.
- Schema validation via Mongoose plus explicit checks in usecases for critical invariants.

### Secrets & Configuration
- Secrets are provided via environment variables and not committed to the repo.
- Production deployment runs as a non-root user.
- Release-based deploys use immutable release directories and atomic cutover.

## Dependency and Supply Chain
- Dependencies are pinned via lockfile.
- CI runs automated tests on pull requests.
- Production installs omit dev dependencies and ignore lifecycle scripts where appropriate.

## Logging & Monitoring
- Sensitive values (passwords, tokens) must not be logged.
- Logs are aggregated via Grafana/Loki; alerts are configured for elevated error rates.
- Sentry integration is in progress for exception aggregation.

## Backups & Recovery
- Daily database backups to object storage (DigitalOcean Spaces).
- Weekly full server backups.
- Backup artifacts are treated as sensitive and access-controlled.

## Responsible Disclosure
Please allow reasonable time to triage and patch issues before public disclosure.
