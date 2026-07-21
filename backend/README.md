# PCmazing Site Backend

NestJS API service for the PCmazing website. Structure mirrors the team's backend baseline (NestJS + raw `pg`), without shared business logic from other projects.

## Structure

```
backend/
├── src/
│   ├── main.ts                 # Bootstrap, CORS, validation, global filters
│   ├── app.module.ts           # Root module
│   ├── common/                 # Filters, interceptors
│   ├── database/               # PostgreSQL pool + query helpers
│   ├── shared/                 # Shared TypeScript types
│   ├── sql/migrations/         # Manual SQL scripts
│   └── website/                # Website domain modules
│       └── contact/            # Contact form (scaffold)
├── test/                       # E2E tests
├── .env.example
└── .env.production.example
```

## Setup

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

## Environment

| Variable | Description |
|---|---|
| `PORT` | API port (default `3000`) |
| `CORS_ORIGINS` | Comma-separated frontend URLs |
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Fallback if no `DATABASE_URL` |
| `DB_SCHEMA` | Postgres schema (default `public`) |
| `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED` | SSL options for managed Postgres |

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health` | Health check + database status |
| GET | `/setup/status` | Database + migration setup status |
| GET | `/setup/migrations` | Bundled, applied, and pending migrations |
| GET | `/setup/migrate/progress` | Current migration progress |
| POST | `/setup/migrate` | Run pending bundled SQL migrations |
| POST | `/setup/migrate/upload` | Upload and run a `.sql` migration file |

### Setup / migration routes

**Upload SQL file (multipart form field: `file`):**

```bash
curl -X POST "http://localhost:3000/setup/migrate/upload" \
  -H "x-setup-key: your-secret-setup-key" \
  -F "file=@./your-schema.sql"
```

**Run bundled migrations from `src/sql/migrations/`:**

```bash
curl -X POST "http://localhost:3000/setup/migrate" \
  -H "x-setup-key: your-secret-setup-key"
```

**Force on existing database:**

```bash
curl -X POST "http://localhost:3000/setup/migrate/upload?force=true" \
  -H "x-setup-key: your-secret-setup-key" \
  -F "file=@./your-schema.sql"
```

If `SETUP_API_KEY` is set in `.env`, all `/setup/*` routes require the `x-setup-key` header.

Applied migrations are tracked in the `_pcmazing_migrations` table.

## Supabase (Transaction Pooler)

This backend uses **`pg` (not TypeORM)** with the same env-based pattern as TypeORM configs.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | **Transaction pooler** URL (port `6543`) for API queries |
| `DATABASE_DIRECT_URL` | **Direct** URL (port `5432`) for migrations/setup |
| `DB_SSL` | `true` for Supabase |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false` for Supabase pooler |
| `DB_CONNECTION_MODE` | Optional: `supabase-pooler`, `supabase-direct`, `local` |

Copy `.env.supabase.example` and fill in your Supabase connection strings from:
**Project Settings → Database → Connection string**

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DATABASE_DIRECT_URL=postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

- **App queries** (contact form) → transaction pooler
- **Setup / migrations** (`/setup`) → direct connection (automatic when `DATABASE_DIRECT_URL` is set)

## Next steps

- Add SQL migrations under `src/sql/migrations/`
- Implement contact form POST in `website/contact`
- Connect Angular frontend to this API
