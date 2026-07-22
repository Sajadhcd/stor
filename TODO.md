# Project Roadmap & TODO List — Nexio Commerce

## Status: **Backend Core Production Ready**

All core backend modules, multi-tenant boundaries, and P1 enterprise security controls (refresh token rotation, webhook signature verification, replay protection, and timestamp drift verification) have been successfully finalized and tested (`18` suites passing, `142` tests).

---

## Completed Tasks (Sprints 1, 2, 2.5 & P1 Security)

- [x] **Sprint 1: Core Foundation & Multi-Tenancy Architecture**
  - [x] Strict ESM & TypeScript setup with NestJS modular boundaries.
  - [x] AsyncLocalStorage (`requestContextStorage`) propagation for `tenantId` & `userId`.
  - [x] Prisma ORM configuration with row-level security (`TenantPrismaService`).
  - [x] Redis caching infrastructure (`CacheService`) with namespace isolation.
  - [x] Structured JSON application logging (`AppLogger`) with correlation IDs.
  - [x] Global RFC 7807 error exception filters and validation pipes.

- [x] **Sprint 2: Core E-Commerce & Identity Modules**
  - [x] Identity & RBAC (`AuthModule`, `UsersModule`) with JWT access tokens.
  - [x] Catalog Management (`CatalogModule`) with multi-variant products and SKU indexing.
  - [x] Multi-Warehouse Inventory (`InventoryModule`) with stock reservation logic.
  - [x] Order Processing & Sales (`SalesModule`) with transactional state machines.
  - [x] Payment Gateways (`PaymentsModule`) supporting `QiCard`, `ZainCash`, and `AsiaHawala`.
  - [x] Platform Administration (`PlatformAdminModule`) for SaaS tenants and subscriptions.

- [x] **Sprint 2.5: Stabilization & Performance Polish**
  - [x] Redis cache pattern invalidation (`tenant:host:*`) and entity caching.
  - [x] Strict security environment validation preventing default secrets in production.
  - [x] Automated test suite creation covering all core controllers and services.

- [x] **P1 Security Hardening (`P1-SEC-05` & `P1-SEC-06`)**
  - [x] **P1-SEC-05: Refresh Token Revocation & Rotation**
    - [x] Implemented `RefreshTokenService` with clean separation of concerns (`AuthService` handles access tokens).
    - [x] Created indexed Redis storage (`refresh:{tenantId}:{userId}:{jti}` + `user-refresh:{tenantId}:{userId}` set).
    - [x] Implemented single-use token rotation and replay/theft detection.
    - [x] Hooked immediate token revocation into user suspension/deletion (`UsersService.update`/`remove`) and tenant suspension/deletion (`TenantAdminService.update`/`remove`).
    - [x] Added `POST /api/v1/auth/logout` endpoint in `AuthController`.
  - [x] **P1-SEC-06: Payment Webhook Signature Verification & Replay Protection**
    - [x] Implemented `WebhookVerifier` interface and concrete classes (`QiCardVerifier`, `ZainCashVerifier`, `AsiaHawalaVerifier`).
    - [x] Created `WEBHOOK_VERIFIER_REGISTRY` (`Map<string, WebhookVerifier>`) in `PaymentsModule` eliminating `switch` and `if/else` chains.
    - [x] Implemented timing-safe HMAC comparison (`crypto.timingSafeEqual`) inside `WebhookSecurityService`.
    - [x] Enforced timestamp validation checking drift within `±300 seconds` (rejecting expired and future timestamps).
    - [x] Enforced Redis replay attack protection (`payment:webhook:{provider}:{eventId}`) with `86400s` TTL and DB checks.
    - [x] Enabled `rawBody: true` option in `main.ts` for untouched cryptographic verification.

---

## Future Roadmap (Next Phases)

- [ ] **Phase 3: Frontend Storefront Integration**
  - [ ] Connect `nexio-storefront` Next.js application to Backend Core APIs.
  - [ ] Implement SSR and client-side authentication flows using rotated refresh tokens.
- [ ] **Phase 4: Advanced Observability & Analytics**
  - [ ] Integrate Prometheus metrics and OpenTelemetry tracing collectors.
  - [ ] Build automated platform analytics export jobs.
- [ ] **Phase 5: High Availability & Multi-Region Readiness**
  - [ ] Configure read-replica routing for `TenantPrismaService` read-only operations.
  - [ ] Implement Redis Sentinel / Cluster configuration support.
