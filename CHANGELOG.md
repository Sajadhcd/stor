# Changelog

All notable changes to the **Nexio Commerce** backend project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-07-26 (Phase B1-E: Attribute Validation, E2E Coverage & Cleanup)

### Status: **Attribute System Hardened**

### Added
- **Phase B1-E1: Attribute Validation Service**
  - Created `AttributeValidationService` to resolve and validate both global and category-scoped attribute definitions.
  - Enforces type constraints for `select` (options values check), `color` (options hex check), `text` (string validation), `number` (finite value check), and `boolean`.
  - Rejects variants or products missing definitions configured with `isRequired: true`.
  - Kept backward compatibility by permitting legacy attributes that don't match active definitions.
- **Phase B1-E2: Attribute Key Normalization**
  - Added `normalizeAttributeKey` utility that lowercases, trims, and replaces spaces and special characters with underscores.
  - Integrated normalization across creating, updating, and duplicate checking of attribute definitions, query filters parsing, variant matrix generation, and dynamic loading.
- **Phase B1-E3: Admin Category Assignment & Specifications**
  - Added category tree multi-select to the Admin Product Form.
  - Enabled dynamic loading and validation of product specifications (`isVariantAxis === false`) based on selected categories.
- **Phase B1-E4: Performance & Cache Hardening**
  - Implemented explicit O(1) set-based cache key tracking (`invalidateKeys` via Redis `sadd`, `smembers`, and `del`) per tenant (`product-keys` and `attr-def-keys`).
  - Completely replaced expensive wildcard `SCAN` operations in Catalog modules with tracked key purging.
  - Created a raw PostgreSQL migration to define an additive GIN `jsonb_path_ops` index on `product_variants.attributes` for high-performance dynamic queries.
- **Phase B1-E5: Final E2E Hardening & Documentation**
  - Added `test/attribute-system.e2e-spec.ts` covering full attribute definitions lifecycles, specifications, variants validation, matrix generation, query filtering, and tenant isolation.
  - Extended Playwright smoke test coverage in `test/browser-smoke.mjs` for admin attributes page, dynamic controls, matrix generator toggles, and storefront dynamic filters.
  - Documented the attribute system architecture, caching, and key resolution rules.

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
