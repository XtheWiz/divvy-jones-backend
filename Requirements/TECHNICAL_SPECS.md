# Divvy-Jones Technical Specifications

## Overview

Divvy-Jones is an expense splitting application designed for groups to track shared expenses, calculate balances, and settle debts.

---

## Tech Stack

### Backend

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| **Runtime** | Bun | 1.x | Fast JavaScript runtime with native TypeScript support |
| **Framework** | Elysia.js | 1.x | High-performance, type-safe web framework |
| **Database** | PostgreSQL | 15+ | Primary data store |
| **ORM** | Drizzle ORM | 0.3x | Type-safe SQL with schema-first approach |
| **Validation** | TypeBox | 0.3x | JSON Schema type builder (Elysia native) |
| **Authentication** | JWT + OAuth2 | - | Custom implementation with provider support |
| **File Storage** | S3-compatible | - | AWS S3 / Cloudflare R2 / MinIO |
| **Cache** | Redis | 7.x | Session cache, rate limiting, realtime pub/sub |

### Key Backend Libraries

```
elysia                  # Web framework
@elysiajs/jwt          # JWT authentication
@elysiajs/cookie       # Cookie handling
@elysiajs/cors         # CORS middleware
@elysiajs/swagger      # OpenAPI documentation
@elysiajs/eden         # End-to-end type-safe client
drizzle-orm            # ORM
drizzle-kit            # Migration tooling
pg                     # PostgreSQL driver
redis                  # Redis client (ioredis)
arctic                 # OAuth2 helper (Google, Apple, etc.)
nanoid                 # ID generation (join codes, tokens)
decimal.js             # Precise monetary calculations
```

### Frontend (Planned)

| Layer | Technology | Notes |
|-------|------------|-------|
| **Mobile** | React Native / Expo | iOS + Android |
| **Web** | Next.js 14+ | Admin dashboard, landing page |
| **State** | Zustand / TanStack Query | Client state + server state |
| **API Client** | Eden Treaty | Type-safe RPC from Elysia |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Mobile App  │  │   Web App    │  │  Admin Panel │          │
│  │ (React Native)│  │  (Next.js)  │  │  (Next.js)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │ Eden Treaty (Type-safe RPC)         │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                      API Gateway                                 │
│  ┌────────────────────────▼────────────────────────────────┐   │
│  │                    Elysia.js                             │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │  Auth   │ │ Groups  │ │Expenses │ │ Settle  │ ...   │   │
│  │  │ Routes  │ │ Routes  │ │ Routes  │ │ Routes  │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                      Data Layer                                  │
│         ┌─────────────────┼─────────────────┐                   │
│         │                 │                 │                   │
│  ┌──────▼──────┐  ┌───────▼──────┐  ┌──────▼──────┐            │
│  │ PostgreSQL  │  │    Redis     │  │  S3/R2      │            │
│  │  (Primary)  │  │   (Cache)    │  │  (Files)    │            │
│  └─────────────┘  └──────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
divvy-jones/
├── src/
│   ├── index.ts              # Application entry point
│   ├── app.ts                # Elysia app configuration
│   │
│   ├── db/
│   │   ├── index.ts          # Database connection
│   │   ├── schema/           # Drizzle schema definitions
│   │   └── seed.ts           # Seed data
│   │
│   ├── routes/
│   │   ├── index.ts          # Route aggregator
│   │   ├── auth.ts           # Authentication routes
│   │   ├── users.ts          # User management
│   │   ├── groups.ts         # Group CRUD
│   │   ├── members.ts        # Group membership
│   │   ├── expenses.ts       # Expense management
│   │   ├── settlements.ts    # Settlement workflows
│   │   └── notifications.ts  # Push notifications
│   │
│   ├── services/
│   │   ├── auth.service.ts   # Auth logic
│   │   ├── expense.service.ts# Expense calculations
│   │   ├── balance.service.ts# Balance calculations
│   │   ├── fx.service.ts     # Currency conversion
│   │   ├── ocr.service.ts    # Receipt OCR
│   │   └── notification.service.ts
│   │
│   ├── middleware/
│   │   ├── auth.ts           # JWT validation
│   │   ├── rateLimit.ts      # Rate limiting
│   │   └── logging.ts        # Request logging
│   │
│   ├── lib/
│   │   ├── redis.ts          # Redis client
│   │   ├── storage.ts        # S3 client
│   │   ├── oauth/            # OAuth providers
│   │   └── utils/            # Helpers
│   │
│   └── types/
│       └── index.ts          # Shared TypeScript types
│
├── drizzle/
│   └── migrations/           # Database migrations
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── drizzle.config.ts         # Drizzle Kit config
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## API Design

### Base URL

```
Production: https://api.divvy-jones.app/v1
Staging:    https://api-staging.divvy-jones.app/v1
Local:      http://localhost:3000/v1
```

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Email registration |
| POST | `/auth/login` | Email + password login |
| POST | `/auth/oauth/:provider` | OAuth login (google, apple, line) |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate tokens |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset with token |

### Core Resources

| Resource | Endpoints |
|----------|-----------|
| Users | `GET/PATCH /users/me`, `GET /users/:id` |
| Groups | `CRUD /groups`, `POST /groups/join` |
| Members | `GET/POST/DELETE /groups/:id/members` |
| Expenses | `CRUD /groups/:id/expenses` |
| Settlements | `CRUD /groups/:id/settlements`, `POST confirm/reject` |
| Notifications | `GET /notifications`, `PATCH read` |

### Response Format

```typescript
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [...]
  }
}

// Paginated
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasMore": true
  }
}
```

---

## Database

### Connection

- **Pool Size:** 10-20 connections (adjustable via env)
- **SSL:** Required in production
- **Timezone:** UTC for all timestamps

### Migrations

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Seed database
bun run db:seed
```

### Key Design Decisions

1. **UUIDs** for all primary keys (client-side generation, no conflicts)
2. **Lookup tables** instead of enums (runtime flexibility)
3. **Soft deletes** for users, groups, expenses (audit trail)
4. **Numeric type** for all monetary values (precision)
5. **JSONB** for flexible data (OCR results, activity logs)

---

## Security

### Authentication Flow

1. **Access Token:** JWT, 15min expiry, stored in memory
2. **Refresh Token:** Opaque, 30 days, stored in httpOnly cookie
3. **Token Rotation:** Refresh tokens are single-use

### Authorization

- Row-level security via application logic
- Group membership checked on every request
- Role-based permissions (owner > admin > member > viewer)

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Auth endpoints | 5 req/min |
| API (authenticated) | 100 req/min |
| File upload | 10 req/min |

### Data Validation

- All inputs validated via TypeBox schemas
- SQL injection prevented by Drizzle parameterization
- XSS prevented by JSON-only responses

---

## Performance

### Caching Strategy

| Data | TTL | Storage |
|------|-----|---------|
| FX rates | 1 hour | Redis |
| User sessions | 30 days | Redis |
| Group balances | 5 min | Redis (invalidate on expense change) |

### Optimizations

- Database indexes on all FK columns and frequent queries
- Partial indexes for active records
- Connection pooling (pg Pool)
- Response compression (gzip)

---

## Monitoring & Logging

### Logging

- Structured JSON logs
- Request ID tracking
- Log levels: error, warn, info, debug

### Metrics (Planned)

- Request latency (p50, p95, p99)
- Error rates
- Database query times
- Active connections

---

## Development

### Prerequisites

- Bun 1.x
- PostgreSQL 15+
- Redis 7.x
- Node.js 20+ (for some tooling)

### Setup

```bash
# Install dependencies
bun install

# Copy environment
cp .env.example .env

# Start database (Docker)
docker compose up -d postgres redis

# Run migrations
bun run db:migrate

# Seed data
bun run db:seed

# Start dev server
bun run dev
```

### Scripts

```json
{
  "dev": "bun run --watch src/index.ts",
  "build": "bun build src/index.ts --outdir=dist --target=bun",
  "start": "bun run dist/index.js",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:seed": "bun run src/db/seed.ts",
  "db:studio": "drizzle-kit studio",
  "test": "bun test",
  "typecheck": "tsc --noEmit"
}
```

---

## Deployment

### Environments

| Environment | Purpose |
|-------------|---------|
| Local | Development |
| Staging | QA, integration testing |
| Production | Live users |

### Infrastructure (Planned)

- **Compute:** Fly.io / Railway / AWS ECS
- **Database:** Neon / Supabase / RDS
- **Redis:** Upstash / ElastiCache
- **Storage:** Cloudflare R2 / S3
- **CDN:** Cloudflare

### Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgres://user:pass@host:5432/divvy_jones

# Redis
REDIS_URL=redis://host:6379

# Auth
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APPLE_CLIENT_ID=...
APPLE_CLIENT_SECRET=...

# Storage
S3_BUCKET=divvy-jones-files
S3_REGION=auto
S3_ENDPOINT=https://...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# External Services
OCR_API_KEY=...
```

---

## Team & Workflow

### Development Team (Multi-Agent)

| Role | Agent Mode | Responsibilities | Worktree |
|------|------------|------------------|----------|
| **Project Owner** | Claude (PO mode) | Sprint features, acceptance criteria, backlog management | Main |
| **Lead Developer** | Claude (Lead Dev mode) | Planning, task breakdown, code review, architecture decisions | `.worktrees/lead-dev` |
| **Backend Developer** | Claude (Backend mode) | Implementation, unit tests, pull requests | `.worktrees/backend-dev` |
| **QA Engineer** | Claude (QA mode) | Test cases, validation, sign-off | `.worktrees/qa` |

### Sprint Process

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SPRINT WORKFLOW                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. PO: Create SPRINT.md        ───►  Define features & acceptance     │
│                                        criteria                         │
│                                                                         │
│  2. Lead Dev: Planning          ───►  PLANNING.md, TASKS.md            │
│                                        Task breakdown & estimation      │
│                                                                         │
│  3. Lead Dev: Assign Tasks      ───►  Allocate to Backend Dev          │
│                                                                         │
│  4. Backend Dev: Implement      ───►  Feature branch in worktree       │
│                                        sprint-XXX/TASK-XXX-desc         │
│                                                                         │
│  5. Backend Dev: Submit         ───►  PR for review                    │
│                                                                         │
│  6. Lead Dev: Review            ───►  REVIEW_LOG.md                    │
│                                        Approve or request changes       │
│                                                                         │
│  7. Lead Dev: Pass to QA        ───►  Hand off for testing             │
│                                                                         │
│  8. QA: Test & Validate         ───►  QA_REPORT.md                     │
│                                        Pass/fail with evidence          │
│                                                                         │
│  9. All: Retrospective          ───►  RETROSPECTIVE.md                 │
│                                        Good/Bad/Action Items            │
│                                                                         │
│  10. Check Retro                ───►  Review before next sprint        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Git Workflow

#### Branch Strategy

```
main                    # Production-ready code
│
└── develop             # Integration branch
    │
    ├── lead-dev/workspace     # Lead Dev working branch
    ├── backend-dev/workspace  # Backend Dev working branch
    └── qa/workspace           # QA working branch
        │
        └── sprint-XXX/TASK-XXX-description  # Feature branches
```

#### Worktree Setup

| Worktree | Branch | Purpose |
|----------|--------|---------|
| Main repo | `develop` | Integration, documentation |
| `.worktrees/lead-dev` | `lead-dev/workspace` | Planning, reviews |
| `.worktrees/backend-dev` | `backend-dev/workspace` | Implementation |
| `.worktrees/qa` | `qa/workspace` | Testing |

#### Feature Branch Naming

```
sprint-001/TASK-001-user-authentication
sprint-001/TASK-002-group-creation
sprint-002/TASK-010-expense-tracking
```

### Communication Protocol

All team communication happens through markdown files in the `Sprints/` directory:

| Document | Purpose | Owner |
|----------|---------|-------|
| `SPRINT.md` | Sprint scope and acceptance criteria | PO |
| `PLANNING.md` | Technical decisions and task breakdown | Lead Dev |
| `TASKS.md` | Task board and status tracking | Lead Dev |
| `REVIEW_LOG.md` | Code review feedback | Lead Dev |
| `QA_REPORT.md` | Test results and bug reports | QA |
| `RETROSPECTIVE.md` | Sprint reflection and improvements | All |

### Sprint Directory Structure

```
Sprints/
├── BACKLOG.md              # Product backlog (all features)
├── CURRENT_SPRINT.md       # Quick reference to active sprint
├── templates/              # Document templates
│   ├── SPRINT_TEMPLATE.md
│   ├── TASK_TEMPLATE.md
│   ├── PLANNING_TEMPLATE.md
│   ├── REVIEW_TEMPLATE.md
│   ├── QA_TEMPLATE.md
│   └── RETRO_TEMPLATE.md
└── sprint-XXX/             # Per-sprint folders
    ├── SPRINT.md
    ├── PLANNING.md
    ├── TASKS.md
    ├── REVIEW_LOG.md
    ├── QA_REPORT.md
    ├── RETROSPECTIVE.md
    └── tasks/              # Detailed task specs
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.2.0 | 2026-01-20 | Added Team & Workflow section |
| 0.1.0 | 2026-01-20 | Initial technical specification |

---

## References

- [Elysia.js Documentation](https://elysiajs.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Bun Documentation](https://bun.sh/docs)
- [ERD Diagram](./ERD.mermaid)
- [SQL Schema](./schema.sql)
