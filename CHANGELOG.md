# Changelog

All notable changes to the **Nexio Commerce** backend project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-07-22 (P1 Security Finalization & Architecture Polish)

### Status: **Backend Core Production Ready**

### Added
- **P1-SEC-05: Enterprise Refresh Token Revocation & Rotation**
  - Created `RefreshTokenService` adhering strictly to Clean Architecture boundaries (`AuthService` remains responsible for Access Tokens while delegating Refresh Token lifecycle management to `RefreshTokenService`).
  - Implemented Redis indexing strategy with two keys per session:
    - Primary token entry: `refresh:{tenantId}:{userId}:{jti}` with TTL matching the refresh token lifetime.
    - Secondary lookup set: `user-refresh:{tenantId}:{userId}` containing active `jti`s for O(1) bulk revocation without using Redis `SCAN`.
  - Added `revokeAllUserTokens(tenantId, userId)` to automatically purge all active refresh tokens when a user is suspended (`SUSPENDED`), deactivated, or deleted via `UsersService.update` and `UsersService.remove`.
  - Added `revokeAllTenantTokens(tenantId)` invoked automatically during tenant suspension or deletion in `TenantAdminService.update` and `TenantAdminService.remove`.
  - Added `rotateRefreshToken(oldToken, ipAddress, userAgent)` enforcing single-use refresh tokens and detecting replay/theft attempts (revoking all tokens if a reused JTI is detected).
  - Added `POST /api/v1/auth/logout` endpoint (`AuthController`) allowing authenticated users to revoke their active refresh token (`jti`).

- **P1-SEC-06: Payment Webhook Signature Verification & Replay Protection**
  - Created `WebhookVerifier` interface inside `src/modules/commerce/payments/security/` for extensibility.
  - Implemented concrete provider verifiers without switch statements or `if/else` chains:
    - `QiCardVerifier` (supports `qicard`, `qi-card`, `qi`)
    - `ZainCashVerifier` (supports `zaincash`, `zain-cash`, `zain`)
    - `AsiaHawalaVerifier` (supports `asiahawala`, `asia-hawala`, `asia`)
  - Registered all verifiers into a Dependency Injection registry map (`WEBHOOK_VERIFIER_REGISTRY`) inside `PaymentsModule` following the Open/Closed Principle.
  - Created `WebhookSecurityService` with a 5-step enterprise verification pipeline:
    1. Provider resolution from registry map without conditional branches.
    2. Provider secret loading (`ConfigService.getWebhookSecret`).
    3. Timing-safe HMAC SHA256 signature comparison (`crypto.timingSafeEqual`) with safe buffer length verification preventing timing side-channel attacks.
    4. Timestamp validation rejecting missing, expired, or future timestamps with a maximum allowed drift of 300 seconds (5 minutes).
    5. Replay attack prevention via Redis caching (`payment:webhook:{provider}:{eventId}`) with a 24-hour TTL (`86400s`) and duplicate event check against `PaymentWebhookEvent` table.
  - Enabled `rawBody: true` in `NestFactory.create` (`src/main.ts`) so exact raw byte strings are preserved for cryptographic signature verification.
  - Integrated `WebhookSecurityService` into `PaymentsService.processWebhook` and `PaymentsController.handleWebhook`.

### Changed
- Refactored `AuthService.login` and `AuthService.refreshToken` to delegate refresh token creation, storage, and rotation completely to `RefreshTokenService`.
- Updated `CacheService` in `src/infrastructure/cache/cache.service.ts` with `set` (Redis `SET` with TTL), `sadd`, `srem`, and `smembers` to support O(1) set operations without scanning.
- Updated project documentation across all reports to reflect the precise architectural status: **Backend Core Production Ready**.

### Fixed
- Fixed potential timing side-channel leaks during webhook signature checks by ensuring `crypto.timingSafeEqual` is executed against buffers of uniform length.
- Prevented circular dependency locks during service boot by utilizing `forwardRef` injection between `UsersService` and `RefreshTokenService`.

---

## [1.0.0] - Prior Sprints (Sprint 1, Sprint 2, Sprint 2.5)

### Status: **Backend Core Production Ready**

### Added
- Multi-tenant Modular Monolith foundation with strict schema isolation (`TenantPrismaService` & `requestContextStorage`).
- Complete core commerce modules: Identity (`Auth`, `Users`), Commerce (`Catalog`, `Inventory`, `Sales`, `Payments`), and Platform Admin (`Tenants`, `Subscriptions`, `Analytics`, `Health`).
- Full Swagger/OpenAPI documentation (`api/docs/swagger`).
- Comprehensive automated test suites across all bounded contexts.
