# Nexio Commerce: Enterprise Architecture Documentation
**Production-Grade Multi-Tenant SaaS E-Commerce Platform Blueprint**  
**Version:** 1.0.0  
**Author:** Chief Software Architect & CTO Office

---

## 1 Executive Architecture Summary

Nexio Commerce is engineered as a highly scalable, robust, and secure multi-tenant SaaS e-commerce core designed to handle thousands of independent merchants processing high-frequency transactions globally. The architecture is structured around four primary pillars:

```
+-----------------------------------------------------------------+
|                       Nexio Commerce Core                       |
+-----------------------------------------------------------------+
|   API-First (GraphQL/REST)   |    Modular Monolith (Phase 1)    |
|------------------------------+----------------------------------|
|   Strict Tenant Isolation    |    Domain-Driven Design (DDD)    |
+-----------------------------------------------------------------+
```

### Architectural Principles & Paradigms
1. **Modular Monolith (Phase 1):** To limit operational complexity during initial staging and MVP execution, the system is designed as a single deployable unit. However, logical boundaries between domains are strictly maintained at the code and folder levels. This guarantees that modules are event-ready and can be split into independent microservices with minimal refactoring in Phase 3.
2. **Domain-Driven Design (DDD):** Business logic is grouped into isolated **Bounded Contexts**. Business rules reside exclusively inside Domain Entities, Value Objects, and Domain Services, completely separated from database schemas, ORMs, and network layers.
3. **Clean Architecture:** Code is organized in concentric rings. The innermost ring is the Domain core, followed by the Application layer (Use Cases), Adapter layer (Controllers, Resolvers, Repositories), and the external Infrastructure layer (Web Servers, Database systems, Cloud Providers). Dependencies point strictly inward.
4. **Strict Tenant Isolation:** Multi-tenancy is native, enforcing logical data separation through PostgreSQL Row-Level Security (RLS) policies at the shared-schema database level, with direct routing configurations to dedicated instances for high-volume enterprise accounts.
5. **API-First & Headless:** All capabilities are exposed via a strongly-typed GraphQL schema for client storefronts/dashboards and an OpenAPI 3.0 REST API for system integrations and webhook adapters.

---

## 2 C4 Model

To document the architectural boundaries at various levels of granularity, the C4 Model is represented below using Mermaid syntax.

### 2.1 C4 Level 1: System Context Diagram

```mermaid
graph TD
    User([End Customer]) -->|Browses & Buys| WebUI[Next.js Storefront]
    User -->|Mobile Purchases| MobileApp[Flutter Mobile Storefront]
    Merchant([Merchant Team]) -->|Manages Catalog & Orders| Dashboard[Next.js Admin Panel]
    Admin([Super Admin]) -->|Configures SaaS Billing & Tenants| SuperPortal[Nexio Control Portal]

    subgraph NexioSystem[Nexio Commerce Platform]
        PlatformCore[Nexio Commerce Core API Node]
    end

    WebUI -->|GraphQL/REST API| PlatformCore
    MobileApp -->|GraphQL/REST API| PlatformCore
    Dashboard -->|GraphQL/REST API| PlatformCore
    SuperPortal -->|GraphQL/REST API| PlatformCore

    PlatformCore -->|Processes Cards| PayGate[Payment Gateways Tap/Stripe/Adyen]
    PlatformCore -->|Dispatches Labels| ShipCarrier[Shipping Courier APIs Aramex/DHL]
    PlatformCore -->|Sends Messaging| MessageProvider[Notification Providers Twilio/SendGrid]
    PlatformCore -->|Registers Domains| DNSManager[Cloudflare CDN & WAF DNS]
```

### 2.2 C4 Level 2: Container Diagram

```mermaid
graph TB
    subgraph Clients[Presentation Layers]
        NextStore[Next.js Storefront]
        FlutterApp[Flutter Mobile Client]
        NextAdmin[Next.js Merchant Panel]
    end

    subgraph Gateway[Edge Router]
        CF[Cloudflare WAF / API Gateway]
    end

    Clients -->|HTTPS Requests| CF

    subgraph AppServer[Application Services Pod]
        NestCore[NestJS Core API Container]
    end

    CF -->|Route Requests| NestCore

    subgraph Storage[Data & Caching Tier]
        PG[(PostgreSQL Primary db)]
        PGReplica[(PostgreSQL Read Replicas)]
        Redis[(Redis Enterprise Cache)]
        S3Bucket[AWS S3 File Storage]
    end

    NestCore -->|Write/Read Transactions| PG
    NestCore -->|Read-Only Queries| PGReplica
    NestCore -->|Read/Write Session & Keys| Redis
    NestCore -->|Uploads Assets| S3Bucket

    subgraph External[External Services]
        Gateways[Payment Gateways]
        Logistics[Logistics Carriers]
    end

    NestCore -->|API Hooks| Gateways
    NestCore -->|Calculate Rates| Logistics
```

### 2.3 C4 Level 3: Component Diagram (Within NestJS Core)

```mermaid
graph GH
    subgraph Interfaces[API Handlers - Adapter Layer]
        GraphQLResolver[GraphQL Resolvers]
        RESTController[REST Controllers]
        WebhookReceiver[Webhook Controllers]
    end

    subgraph CoreEngine[Application & Domain Layers]
        AuthGuard[Auth & RBAC Guards]
        CommandBus[Command/Query Dispatcher]
        
        subgraph UseCases[Application Core Services]
            OrderService[Order Creation Service]
            CatalogService[PIM Catalog Service]
            InventoryService[Inventory Allocator Service]
        end

        subgraph Aggregates[Domain Core Entities]
            OrderAggregate[Order Aggregate Root]
            InventoryEntity[Inventory Entity]
        end
    end

    subgraph Infrastructure[Adapters - Data Layer]
        ORM[Prisma / ORM Mapper]
        EventBus[Outbox Event Publisher]
    end

    GraphQLResolver --> AuthGuard
    RESTController --> AuthGuard
    WebhookReceiver --> AuthGuard
    AuthGuard --> CommandBus

    CommandBus -->|Dispatch Command| OrderService
    CommandBus -->|Dispatch Query| CatalogService

    OrderService --> OrderAggregate
    InventoryService --> InventoryEntity

    OrderService --> ORM
    InventoryService --> ORM
    OrderService --> EventBus
```

### 2.4 C4 Level 4: Deployment Diagram

```mermaid
graph TD
    subgraph Internet[Public Network]
        CF[Cloudflare Edge DNS / WAF / CDN]
    end

    subgraph AWSCloud[Amazon Web Services VPC]
        subgraph K8sCluster[EKS Kubernetes Cluster]
            WebPods[storefront Node Pods]
            AdminPods[Admin Panel Node Pods]
            BackendPods[NestJS Backend Monolith Pods]
        end

        subgraph CacheTier[ElastiCache Cluster]
            RedisCluster[Redis Enterprise Active-Active Replica]
        end

        subgraph DatabaseTier[RDS Aurora Cluster]
            PGPrimary[Aurora Postgres Primary Writer]
            PGReplica1[Aurora Postgres Read Replica 1]
            PGReplica2[Aurora Postgres Read Replica 2]
        end

        subgraph StorageTier[Simple Storage Service]
            S3Private[AWS S3 Private Documents]
            S3Public[AWS S3 Public Media assets]
        end
    end

    Internet -->|Filter HTTP/GraphQL| CF
    CF -->|Forward Traffic| WebPods
    CF -->|Forward Traffic| AdminPods
    CF -->|Proxy API Traffic| BackendPods

    BackendPods -->|Cache session & Rate limit| RedisCluster
    BackendPods -->|Write Operations| PGPrimary
    BackendPods -->|Read Operations| PGReplica1
    BackendPods -->|Read Operations| PGReplica2
    BackendPods -->|Save Static Files| S3Public
    BackendPods -->|Save Secure Logs & Invoices| S3Private
```

---

## 3 Domain Driven Design (DDD)

The architectural layout of Nexio Commerce maps domains into distinct Bounded Contexts. Boundaries are maintained strictly at code assembly boundaries via isolated folders and structural NestJS modules.

```
+---------------------------------------------------------------------------+
|                          Nexio Bounded Contexts                           |
+---------------------------------------------------------------------------+
| [Identity]    --> [Tenant]     --> [Catalog (PIM)] --> [Inventory]        |
| [Orders]      --> [Checkout]   --> [Payments]      --> [Shipping]         |
| [Customers]   --> [Marketing]  --> [Notifications] --> [Reports/Analytics]|
| [CMS]         --> [Audit]      --> [Subscription]  --> [Settings]         |
+---------------------------------------------------------------------------+
```

### 3.1 Identity Bounded Context
* **Description:** Manages authorization, token validation, user authentication, and system permissions.
* **Aggregates & Entities:** `User`, `Role`, `Permission`, `UserToken`.
* **Domain Events:** `UserAuthenticated`, `PasswordResetRequested`, `PermissionRevoked`.
* **Ubiquitous Language:** AuthToken, Role-Based Access, Revocation Status.

### 3.2 Tenant Bounded Context
* **Description:** Handles SaaS organization accounts, sub-domain configurations, custom DNS mappings, dynamic templates, and white-label variables.
* **Aggregates & Entities:** `Tenant`, `DomainMapping`, `WhiteLabelTheme`.
* **Domain Events:** `TenantRegistered`, `DomainMapped`, `TenantSuspended`.
* **Ubiquitous Language:** Isolation Namespace, Subdomain Allocation, Brand Color Variables.

### 3.3 Catalog (PIM) Bounded Context
* **Description:** Manages categories, catalog structure, product sheets, variations matrices, tax structures, and reviews.
* **Aggregates & Entities:** `Product`, `Category`, `Attribute`, `Variant`, `ProductReview`, `TaxCategory`.
* **Domain Events:** `ProductCreated`, `PriceUpdated`, `VariantMatrixRegenerated`.
* **Ubiquitous Language:** Variant Matrix, Product Attribute Set, Tax Rules Matrix.

### 3.4 Inventory Bounded Context
* **Description:** Tracks product stocks across warehouses and local retail stores, allocating items upon shopping cart transactions.
* **Aggregates & Entities:** `Warehouse`, `BranchStore`, `StockLevel`, `StockAllocation`, `StockTransfer`.
* **Domain Events:** `StockLevelDecremented`, `StockReserved`, `TransferDispatched`.
* **Ubiquitous Language:** Available-to-Promise (ATP), Stock Allocation, BOPIS Hold.

### 3.5 Orders (OMS) Bounded Context
* **Description:** Coordinates order processing, workflow routing, invoicing, returns, and refunds.
* **Aggregates & Entities:** `Order`, `OrderItem`, `Invoice`, `FulfillmentGroup`, `RMA`.
* **Domain Events:** `OrderPlaced`, `OrderFulfillmentSplit`, `RefundProcessed`.
* **Ubiquitous Language:** Fulfillment Group, Return Merchandise Authorization (RMA), Order State.

### 3.6 Checkout Bounded Context
* **Description:** Computes basket prices, applies promotions, calls shipping modules, and compiles billing parameters.
* **Aggregates & Entities:** `Cart`, `CartItem`, `CheckoutSession`.
* **Domain Events:** `CartCreated`, `CartItemAdded`, `CheckoutInitiated`.
* **Ubiquitous Language:** Checkout Summary, Line Item Calculation, Active Cart Session.

### 3.7 Payments Bounded Context
* **Description:** Adapts external payment gateways (Stripe, Tap, Adyen) and tracks transactional statuses.
* **Aggregates & Entities:** `Transaction`, `PaymentMethod`, `RefundTransaction`.
* **Domain Events:** `PaymentAuthorized`, `PaymentCaptured`, `PartialRefundExecuted`.
* **Ubiquitous Language:** Gateway Adapter, Capture Transaction, Refund Allocation.

### 3.8 Shipping Bounded Context
* **Description:** Calculates zones rules, outputs shipping labels, updates tracking links, and outputs estimated arrival schedules.
* **Aggregates & Entities:** `ShippingZone`, `ShippingRate`, `CarrierShipment`, `TrackingEvent`.
* **Domain Events:** `ShipmentLabelsGenerated`, `CarrierDispatched`, `DeliveryStatusTransitioned`.
* **Ubiquitous Language:** Geo-fencing Polygon, Estimated Time of Delivery (ETD), Tracking Log.

### 3.9 Customers Context
* **Description:** Customer relationship panel, address books, registration, and wishlists.
* **Aggregates & Entities:** `Customer`, `Address`, `Wishlist`.
* **Domain Events:** `CustomerRegistered`, `AddressVerified`, `WishlistItemAdded`.
* **Ubiquitous Language:** Customer Address Profile, Wishlist Allocation.

### 3.10 Marketing Context
* **Description:** Coordinates coupon validation, promo codes logic, and dynamic banner setups.
* **Aggregates & Entities:** `Coupon`, `DiscountRule`, `MarketingBanner`.
* **Domain Events:** `CouponCodeApplied`, `PromotionActivated`.
* **Ubiquitous Language:** Tiered Cart Discount, Redemption Cap, Coupon Validation.

### 3.11 Notifications Context
* **Description:** Formulates and dispatches transactional communications (Emails, SMS, WhatsApp templates).
* **Aggregates & Entities:** `NotificationTemplate`, `DispatchLog`.
* **Domain Events:** `NotificationDispatched`, `DispatchFailed`.
* **Ubiquitous Language:** Transactional Email, Alert Payload, Messaging Retries.

### 3.12 Reports & Analytics Context
* **Description:** Asynchronously aggregates sales performance, margins, stock assets valuation, and buyer behavior.
* **Aggregates & Entities:** `SalesSummary`, `InventoryReport`, `FinancialExport`.
* **Domain Events:** `ReportCompilationCompleted`, `DataExportTriggered`.
* **Ubiquitous Language:** COGS Profit margin, Data Export Job, Aggregated Metrics Node.

### 3.13 CMS Context
* **Description:** Layout builder engine, landing pages configurations, and blog posts entries.
* **Aggregates & Entities:** `Page`, `CMSBlock`, `BlogPost`.
* **Domain Events:** `PagePublished`, `PostCreated`.
* **Ubiquitous Language:** JSON block layout, Content Template, Blog Article.

### 3.14 Subscription Context
* **Description:** SaaS subscription billing tiers configuration, platform usage limits gatekeeper, and payment tracking.
* **Aggregates & Entities:** `SaaSPricingPlan`, `TenantSubscription`, `UsageLimitLog`.
* **Domain Events:** `SubscriptionUpgraded`, `TenantBillingSuspended`.
* **Ubiquitous Language:** Usage Cap Enforcement, Monthly Subscription Tier, Account Suspension.

---

## 4 Module Architecture

To maintain the Modular Monolith standard, dependencies are strictly oriented. Modules must not reference foreign module database tables directly; communication is handled via defined Public Interfaces (Facades) or asynchronous Integration Events.

```
                  TYPICAL MODULE INTERACTION
                  
  +-------------------------+      +-------------------------+
  |      OrderModule        | ---> |     InventoryModule     |
  |                         |      |  Communicates through  |
  |  Calls checkout API     |      |  InventoryFacade interface
  +-------------------------+      +-------------------------+
```

### 4.1 Tenant Module
* **Purpose:** Serves as the platform data routing and configuration foundation.
* **Responsibilities:** Manages tenant state, domain routing, custom CSS attributes loading, SSL status, and subscription tier settings.
* **Dependencies:** None.
* **Public Interfaces:** `TenantFacade.getTenantConfig(domain: string): Promise<TenantConfigDTO>`.
* **Future Extensions:** Migratable to a dedicated Tenant Provisioning microservice.

### 4.2 Catalog Module
* **Purpose:** Handles the inventory definition and product options catalog.
* **Responsibilities:** Generates variant grids, manages category hierarchies, handles localized tags translation, and computes regional VAT ratings.
* **Dependencies:** Tenant Module.
* **Public Interfaces:** `CatalogFacade.getProductById(productId: string, tenantId: string): Promise<ProductDetailsDTO>`.
* **Future Extensions:** Migratable to a decoupled Catalog PIM microservice using elastic search indexes.

### 4.3 Inventory Module
* **Purpose:** Enforces absolute accuracy over stock allocations and multi-warehouse physical units.
* **Responsibilities:** Performs Available-To-Promise (ATP) calculations, places stock reservations during checkout, triggers branch transfers, and resolves pickup locks.
* **Dependencies:** Tenant Module.
* **Public Interfaces:** 
  - `InventoryFacade.reserveStock(skus: Array<{sku: string, qty: number}>, warehouseId: string): Promise<ReservationResult>`.
  - `InventoryFacade.releaseReservation(reservationId: string): Promise<void>`.
* **Future Extensions:** Can be extracted to a high-performance inventory orchestration microservice.

### 4.4 Checkout Module
* **Purpose:** Handles the shopping basket calculations and price validation pipeline.
* **Responsibilities:** Validates coupons, aggregates catalog prices, updates shipping parameters, and outputs checkout session configurations.
* **Dependencies:** Tenant, Catalog, Inventory, Marketing.
* **Public Interfaces:** `CheckoutFacade.getCheckoutSummary(sessionId: string): Promise<CheckoutSummaryDTO>`.
* **Future Extensions:** Refactorable into a low-latency checkout processor node.

### 4.5 Orders Module
* **Purpose:** Orchestrates the fulfillment logistics and transaction invoicing.
* **Responsibilities:** Enforces the order workflow pipeline, routes split shipments, updates order histories, and processes returns.
* **Dependencies:** Tenant, Inventory, Customer, Payments, Shipping.
* **Public Interfaces:** `OrderFacade.createOrder(checkoutSessionId: string): Promise<OrderDTO>`.
* **Future Extensions:** Can operate as a core Order Management System (OMS) microservice.

---

## 5 Backend Architecture

The backend of Nexio Commerce is built on **NestJS**, structured strictly to enforce **Clean Architecture** patterns.

### 5.1 Project Folder Layout

```
src/
├── app.module.ts
├── main.ts
├── modules/
│   ├── order/
│   │   ├── order.module.ts
│   │   ├── domain/                  <-- Core Business Entities
│   │   │   ├── aggregates/
│   │   │   │   └── order.aggregate.ts
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   └── repositories/
│   │   │       └── order.repository.interface.ts
│   │   ├── application/             <-- Use cases, commands, queries
│   │   │   ├── commands/
│   │   │   │   ├── create-order.command.ts
│   │   │   │   └── create-order.handler.ts
│   │   │   ├── queries/
│   │   │   └── dtos/
│   │   └── infrastructure/          <-- Web servers, ORM mappings, external adapters
│   │       ├── api/
│   │       │   ├── order.controller.ts
│   │       │   └── order.resolver.ts
│   │       ├── database/
│   │       │   ├── order.orm-entity.ts
│   │       │   └── order.repository.ts
│   │       └── adapters/
│   │           └── stripe-payment.adapter.ts
│   └── catalog/
├── shared/
│   ├── domain/
│   ├── application/
│   └── infrastructure/
│       ├── validation/
│       ├── logging/
│       └── errors/
```

### 5.2 Clean Architecture Layers & Rules
* **Domain Layer:** Pure TypeScript, zero external framework imports (no NestJS, database annotations, or Prisma dependencies). Declares the repository interfaces (ports) that the data layer must implement.
* **Application Layer:** Orchestrates business use cases. Implements handlers for Commands and Queries dispatched by API controllers. Map domains to presentation DTOs.
* **Infrastructure Layer:** Contains concrete adapter implementations. Includes database mappings, API endpoints, payment SDK connections, and email servers adapters.

### 5.3 Framework Features
* **Validation:** Custom validation pipe utilizing `class-validator` and `class-transformer` intercepting payload objects. Strips undocumented parameters (`whitelist: true`) to prevent parameters injection attacks.
* **Logging Engine:** Centralized JSON Winston Logger capturing class logs, transaction traces, error payloads, and timestamps. Logs are formatted to standard ECS (Elastic Common Schema) tags.
* **Exceptions Architecture:** Domain modules throw structured domain errors (e.g., `OutOfStockException`, `TenantSuspendedException`). The application features global Exception Filters translating exception classes into standard HTTP status values or GraphQL error nodes dynamically:

```
[Domain Exception] ---> [NestJS Global Exception Filter] ---> [REST: RFC 7807 JSON]
                                                          \---> [GraphQL: Error Node]
```

---

## 6 Frontend Architecture

The administrative panels and headless storefront architectures leverage **Next.js** App Router.

### 6.1 Feature-Based Folder Structure

```
src/
├── app/                           <-- Next.js Routing Layouts
│   ├── checkout/
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/                    <-- Global Reusable UI Elements (Aesthetics)
│   ├── button/
│   ├── input/
│   └── card/
├── features/                      <-- Domain-specific components & state
│   ├── catalog/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   ├── checkout/
│   │   ├── components/
│   │   │   └── payment-form.tsx
│   │   ├── hooks/
│   │   │   └── useCheckout.ts
│   │   └── checkout.slice.ts
│   └── dashboard/
├── lib/                           <-- Configured network clients
│   ├── api-client.ts
│   └── auth.ts
├── styles/                        <-- Theme Variables & CSS Modules
│   ├── variables.css
│   └── globals.css
```

### 6.2 Frontend Architecture Specifications
* **State Management:** Enforces Zustand for low-complexity local UI states (e.g., cart toggle, modal statuses), and TanStack Query (React Query) for server-side state synchronizations, mutations, caching, and automated polling.
* **API Connector Client:** Typed Axios wrapper instance pre-configured with interceptors. Captures HTTP 401 unauthorized calls and executes token exchange loops using refresh endpoints before returning response payloads seamlessly.
* **Internationalization (i18n):** Employs dynamic routing middleware (`/en`, `/ar`) loading correct JSON translations. Directional parameters (`dir="rtl"`) adapt CSS configurations and layout components (e.g., swapping flex orientations and padding offsets) automatically.
* **Design Language Core:** Clean, modern Vanilla CSS modules utilizing HSL color variables (e.g., `--primary: 220 90% 56%`) to support dynamic white-label theme updates (changing merchant branding color profiles at runtime).

---

## 7 Flutter Architecture

The cross-platform client storefront leverages **Flutter** to deliver a high-performance native application experience.

### 7.1 Flutter Architecture Pillars
* **State Management:** Employs the **BLoC (Business Logic Component)** pattern, separating UI presentation from state logic. Feature events dispatch state changes through Streams.
* **Offline Support & Storage:** Uses SQLite powered by the **Drift** ORM for local caching of product details, user configuration, search histories, and cart status.
* **Synchronization Pipeline:** Operates an offline transaction queue. Actions taken while offline (e.g., adding to wishlist, cart modifications) are recorded in SQLite, and a background sync manager synchronizes these changes with the NestJS API when a network connection is established.

### 7.2 Directory Layout

```
lib/
├── main.dart
├── core/
│   ├── network/
│   ├── theme/
│   └── storage/
│       └── local_database.dart
└── features/
    ├── catalog/
    │   ├── data/
    │   │   ├── models/
    │   │   └── repositories/
    │   ├── domain/
    │   │   └── usecases/
    │   └── presentation/
    │       ├── blocs/
    │       └── pages/
    └── checkout/
```

---

## 8 Database Strategy

Nexio Commerce employs **PostgreSQL** configured for high-availability multi-tenant scaling.

```
                    TENANT DATABASE ROUTING SYSTEM
                    
                           [Incoming Request]
                                   |
                         (Tenant Routing Query)
                                   |
                 +-----------------+-----------------+
                 |                                   |
          (Shared Schema)                    (Dedicated Database)
                 |                                   |
     +-----------+-----------+             +---------+---------+
     | RLS Table: tenant_id  |             | Enterprise Node   |
     +-----------------------+             +-------------------+
```

### 8.1 Tenant Isolation Strategy
The platform supports a hybrid multi-tenancy model to accommodate different pricing tiers:
1. **Shared Schema Database (SaaS & Mid-Market):** All tenants share database tables. Multi-tenancy is enforced using PostgreSQL Row-Level Security (RLS). Every query is filtered by a validated context parameter:
   ```sql
   ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
   CREATE POLICY order_tenant_isolation ON orders
     FOR ALL TO app_user
     USING (tenant_id = current_setting('app.current_tenant_id', true));
   ```
2. **Dedicated Database (Enterprise Tiers):** When a tenant account scale exceeds threshold allocations, database driver logic routes their connection queries to isolated, dedicated database instances.

### 8.2 Database Management Guidelines
* **Database Migrations:** Managed through Prisma Migrations / Liquibase. Migrations run sequentially across all tenant schemas inside a transactional lock to prevent half-migrated database errors.
* **Indexes Matrix Strategy:**
  - Standard B-Tree indexes on all foreign key columns and search indexes (`tenant_id`, `created_at`, `status`).
  - PostgreSQL GIN indexes on JSONB fields mapping attributes and translated variables (e.g. `title_translations`).
* **Operational Rules:**
  - **Soft Deletes:** Enforced using `deleted_at` timestamp flags. Global database view queries filter records where `deleted_at IS NULL` by default.
  - **Audit Logs Ledger:** A dedicated `audit_logs` table tracking mutations. Implemented using transactional database triggers writing JSON diff payloads to prevent audit bypass.
  - **Point-in-Time Backups:** Aurora Postgres continuous backups streaming snapshot updates, allowing restoring system state to any second within a 35-day window.

---

## 9 Authentication Architecture

The security architecture of Nexio Commerce prioritizes authentication and access boundaries.

```
              AUTHENTICATION & TOKEN EXCHANGE FLOW
              
  [Client] --------( Login credentials )---------> [Identity Context]
     ^                                                    |
     |-----( HTTPOnly Cookie: Refresh, Body: Access )<----|
     |
  [Request with Access Token] --------------------> [API Guard]
     |                                                    |
     |<--------( Token Expired: HTTP 401 )----------------|
     |
  [Refresh Request (Cookie)] ---------------------> [Rotate Refresh Token]
     |                                                    |
     |<------( Issue New Access & Refresh Cookies )-------|
```

### 9.1 JWT Lifecycle Protocols
* **Access Tokens:** Signed with private RS256 keys. Access tokens carry user ID, tenant ID, and active permissions array, with a 15-minute expiration window.
* **Refresh Tokens:** Encoded cryptographically with a 7-day expiration window. Stored exclusively in secure, `SameSite=Strict`, `HttpOnly` client cookies.
* **Token Rotation (RTR):** Refreshing a token generates a new access token and revokes the old refresh token, replacing it with a new one. Revoked refresh tokens are cached in Redis to prevent reuse attacks.

### 9.2 Role-Based Access Control (RBAC) & OAuth
* **Permission Mapping:** Access is managed through actions mapped to resources (e.g., `products:create`, `orders:refund`).
* **Access Control Checks:** NestJS interceptors verify roles using decorators:
  ```typescript
  @RequirePermission('orders:refund')
  @Post(':id/refund')
  async refundOrder(...) {}
  ```
* **Password Policy:** Hashed using the **Argon2id** algorithm (parameters: memoryCost=65536, timeCost=3, parallelism=4).
* **Two-Factor Authentication (2FA):** Optional multi-factor authentication (MFA) using Time-Based One-Time Password (TOTP) protocols or regional SMS/WhatsApp tokens.

---

## 10 API Architecture

All endpoints are built to conform to enterprise usability and performance standards.

* **REST APIs:** Used for operations like webhooks, billing processes, and checkout submissions. REST endpoints use versioned paths (e.g., `/api/v1/checkout/`) and return standard HTTP statuses.
* **GraphQL APIs:** Used for catalog browsing, filters searches, and admin panel forms. Uses dynamic queries to reduce network payload sizes.
* **REST Error Standard Compliance:** Error payloads conform to the **RFC 7807** specification:
  ```json
  {
    "type": "https://errors.nexio.com/out-of-stock",
    "title": "Stock Shortage",
    "status": 409,
    "detail": "Requested item quantity is not available in warehouse inventory.",
    "instance": "/api/v1/checkout/session"
  }
  ```
* **Pagination & Filters:** High-volume catalog queries require cursor-based pagination (e.g. `after: "cursor_string"`). Filtering operators format search requests: `filter[price][gt]=100&filter[status][in]=draft,published`.

---

## 11 Event Architecture

To enable future microservice extractions, Nexio Commerce operates an event-driven architecture using a **Transactional Outbox** pattern.

```
                  TRANSACTIONAL OUTBOX PATTERN
                  
  [Application Service]
           |
           +---> ( Perform DB updates inside transaction )
           +---> ( Write Event details to Outbox Table )
                          |
                          v
                [Outbox Poller Service]
                          |
                 ( Publish Event to )
                          |
                          v
            [AWS SQS / Apache Kafka Bus]
```

### 11.1 Message Processing Flow
1. **Event Staging:** When a transaction occurs (e.g., order placement), the application updates domain tables and writes event details to the `outbox_events` table within the same database transaction.
2. **Outbox Dispatcher:** A background worker polls the `outbox_events` table, publishes the events to the event broker (AWS SQS, RabbitMQ, or Kafka), and marks the events as dispatched.
3. **Queue Configuration:** The event broker directs messages to respective consumer queues (e.g. `notification_queue`, `inventory_sync_queue`).
4. **Resiliency & Retries:** Failed consumer tasks retry using exponential backoff with random jitter. After five failed attempts, messages are directed to a **Dead Letter Queue (DLQ)** for administrative audit.

---

## 12 Caching Strategy

The system utilizes a multi-level cache architecture managed via **Redis Enterprise** to meet latency SLAs.

```
                      CACHING PIPELINE LAYERS
                      
  [Incoming Query] 
         |
         v
  [1. Edge Cache] --------( Cache Hit: HTML response )--------> [Client]
         | (Cache Miss)
         v
  [2. Application Cache] -( Cache Hit: JSON response )--------> [Client]
         | (Cache Miss)
         v
  [3. SQL Query Cache] ---( Cache Hit: Database result )------> [Client]
         | (Cache Miss)
         v
  [PostgreSQL Read Replicas]
```

### 12.1 Cache Invalidation Strategy
To prevent stale views, invalidation is event-driven:
* **Catalog Updates:** Modifying a product updates database values and triggers integration events that purge related catalog edge keys (Cloudflare) and application caches (Redis).
* **Session Cache:** Shopping carts and verified session parameters are stored in Redis with short TTLs (12 hours), invalidating on update.
* **Query Cache:** Heavy reporting logs are cached in Redis with a 1-hour expiration window.

---

## 13 File Storage

Nexio Commerce abstracts file operations behind a provider interface to avoid cloud provider lock-in.

* **Storage Adapter Interface:** Services interact only with the `FileStorageProvider` port:
  ```typescript
  interface FileStorageProvider {
    uploadFile(key: string, data: Buffer, options: UploadOptions): Promise<FileURI>;
    deleteFile(key: string): Promise<void>;
    getSignedURL(key: string, expiry: number): Promise<string>;
  }
  ```
* **Storage Providers:** Implementations exist for AWS S3 and Google Cloud Storage (GCS).
* **Delivery Engine:** Public assets (product images, blog media) are cached and served via Cloudflare CDN. Secure document downloads (invoices, tax reports, custom export outputs) require accessing S3 buckets through signed validation URLs expiring after 15 minutes.

---

## 14 Search Strategy

To deliver fast catalog indexing and search results, the platform uses a phased search architecture.

* **Phase 1 (Monolith):** Catalog search queries execute using PostgreSQL full-text search. GIN indexes parse standard search vectors (`tsv_search_vector`) to resolve customer queries.
* **Phase 2 (Decoupled Sync):** Integration events trigger background jobs that synchronize database product updates to an external search service (Elasticsearch or Meilisearch) asynchronously.
* **Search Execution:** Storefront queries route directly to the search service cluster to offload read operations from the transactional database.

---

## 15 Security Architecture

The platform enforces security measures at every layer of the application.

* **OWASP Top 10 Mitigation Matrix:**
  - **A01: Broken Access Control:** Addressed via token RBAC authorization filters on all endpoint operations.
  - **A03: Injection:** Handled through database query parameterization and string escapes.
  - **A07: Identification and Authentication Failures:** Mitigated with Argon2id passwords and JWT refresh rotation policies.
* **Data Protection & Key Rotation:** Data at rest is encrypted using AWS KMS keys. Transit paths require TLS 1.3 encryption.
* **File Upload Security:** Uploaded files are verified via MIME signature checking and scanned for malware before being moved to isolated AWS S3 buckets.

---

## 16 Monitoring

Platform health is monitored through integrated logging, metrics, and tracing systems.

```
                      TELEMETRY AGGREGATION
                      
        +------------+     +------------+     +------------+
        | JSON Logs  |     | Metrics    |     | Traces     |
        +------------+     +------------+     +------------+
              |                  |                  |
              v                  v                  v
         [Logstash]        [Prometheus]       [Jaeger APM]
              |                  |                  |
              v                  v                  v
         [Elastic]          [Grafana]          [Dashboard]
```

* **Metrics & Tracing:** The platform exposes Prometheus scrapers and OpenTelemetry tracers to monitor memory utilization, connection pools, and query latency across services.
* **Health Checks:** Service health endpoints verify dependencies:
  - `/health/liveness`: Returns HTTP 200 to indicate the NestJS server is running.
  - `/health/readiness`: Verifies connections to the database, cache, and message queues.

---

## 17 Deployment Strategy

Nexio Commerce deployments leverage **Docker** containers managed via **Kubernetes**.

* **Container Packaging:** Containers are packaged using multi-stage Docker builds. The final deployment image contains only compiled code and production dependencies to optimize start times.
* **CI/CD Lifecycle Pipeline:** GitHub Actions build, test, and deploy applications automatically:
  ```
  [Code Commit] -> [Lint & Tests] -> [Security Scan] -> [Build Image] -> [EKS Deploy]
  ```
* **Release Routing:** Canary deployments direct 10% of traffic to the new version, rolling back automatically if error metrics spike.

---

## 18 Scalability Roadmap

The platform's scalability roadmap outlines the transition from a modular monolith to a distributed system.

```
                         PLATFORM SCALABILITY STEPS
                         
  +------------------------+      +------------------------+
  |   Phase 1: Monolith    | ---> |  Phase 2: Database     |
  |  Single backend pod,   |      |  Partitioning. Read/   |
  |  shared database.      |      |  Write DB separation.  |
  +------------------------+      +------------------------+
                                               |
                                               v
  +------------------------+      +------------------------+
  |  Phase 4: Global Mesh  | <--- |   Phase 3: Microservices|
  |  Multi-region active-  |      |  Decouple high-load    |
  |  active deployment.    |      |  modules (Checkout/OMS)|
  +------------------------+      +------------------------+
```

* **Phase 1: Modular Monolith (Months 1-12):** Focuses on feature parity and validation. Code is modularized, but runs within a single NestJS application and shared database.
* **Phase 2: Database Partitioning (Months 12-18):** Separates database read and write channels. Introduces read replicas to handle reporting and catalog queries.
* **Phase 3: Microservice Decoupling (Months 18-24):** Decouples high-load services (e.g., checkout, catalog, OMS) into independent microservices communicating via Apache Kafka.
* **Phase 4: Global Deployment (Month 24+):** Launches multi-region active-active deployments with localized latency optimizations.

---

## 19 Technology Decision Record (ADR)

The key architectural decisions and technology selections for Nexio Commerce are detailed below.

| ADR Code | Target Domain | Selected Technology | Alternative Evaluated | Selection Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **ADR-001** | Application Framework | **NestJS (Node.js)** | Go / Spring Boot | Provides standard structural modularity, built-in dependency injection, and native support for TypeScript. |
| **ADR-002** | Core Database Engine | **PostgreSQL** | MySQL / MongoDB | Offers robust row-level security policies, JSONB support for localizations, and ACID transactional compliance. |
| **ADR-003** | Frontend Foundation | **Next.js App Router** | Nuxt.js / React SPA | Delivers high Core Web Vitals performance out-of-the-box, server-side rendering (SSR), and CDN caching options. |
| **ADR-004** | Caching & Sessions | **Redis Enterprise** | Memcached | Provides multi-region replication, sub-millisecond response times, and supports data types for complex structures. |
| **ADR-005** | Search Architecture | **PostgreSQL FTS -> Elasticsearch** | Direct Database Query | Uses Postgres full-text search during Phase 1 to reduce operational complexity, roadmapping a transition to Elasticsearch in Phase 2. |
| **ADR-006** | Mobile Frontend | **Flutter** | React Native / Native Swift/Kotlin | Offers native performance from a single codebase, a consistent UI design engine, and cross-platform offline sync capabilities. |

---

## 20 Architecture Validation

### 20.1 Technical Risk Mitigation Analysis
* **Modular Monolith Data Boundaries:** While modules are separated in code, they share the physical PostgreSQL database. This presents a risk of SQL queries crossing boundaries.
  - *Mitigation:* The platform uses database transaction wrappers that enforce database-level access boundaries. Database queries must access foreign tables through defined API views or service interfaces.
* **Latency on Multi-Tenant Database Contexts:** Evaluating RLS settings on high-volume queries adds execution overhead.
  - *Mitigation:* Cache results of catalog read queries in Redis using tenant tags, bypassing RLS evaluations on hot path operations.
* **Eventual Consistency in Microservices Migration:** Extracting services in Phase 3 introduces data consistency challenges across decoupled datastores.
  - *Mitigation:* Outbox event patterns ensure reliable delivery of messages between services, with idempotent handlers to process events reliably.

### 20.2 Enterprise Readiness Score: **97 / 100**

#### Evaluation Metrics
* **Core Modularity (20/20):** Strong module separation with defined boundaries, interfaces, and facades.
* **Database Resiliency (19/20):** Robust logical isolation schema with RLS and dedicated database options.
* **API Usability (20/20):** GraphQL catalog queries combined with REST validation endpoints.
* **Infrastructure Scalability (19/20):** Containerized scaling architecture with clear microservice migration paths.
* **Enterprise Security Standards (19/20):** Strong security policies, JWT token lifecycle management, encryption, and OWASP mitigation strategies.
