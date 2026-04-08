# ARD CRM — Sales Intelligence Platform
ARD Builders & Developers · Neon Postgres CRM

Production CRM built on Next.js API routes with Neon Postgres as the persistent data store. Includes lead CRUD, analytics, CSV export, webhook ingestion, and connector scaffolding for ERP/ads/telephony sync.

## Stack
- Frontend: Next.js + React
- Backend: Next.js API Routes
- Database: Neon Postgres
- Charts: Recharts
- Deployment: Vercel

## Quick Start
1. Install dependencies.
```bash
npm install
```

2. Configure environment variables.
```bash
cp .env.example .env.local
```

3. Set at least these values in .env.local.
```bash
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require&channel_binding=require
WEBHOOK_SECRET=<secure-random-string>
```

4. Run locally.
```bash
npm run dev
```

The API auto-creates the leads table and required indexes in your Neon database on first access.

## Data Model
Primary table: public.leads

Canonical columns:
- id
- name
- company
- email
- phone
- status
- stage
- source
- assigned_to
- notes
- tags
- follow_up
- created_at
- updated_at
- value
- city
- deleted
- extra (jsonb)

Unknown incoming fields are stored in extra and still rendered in lead detail views.

## API Routes
- GET /api/leads
- POST /api/leads
- GET /api/leads/:rowIndex
- PUT /api/leads/:rowIndex
- DELETE /api/leads/:rowIndex
- GET /api/leads/search
- POST /api/leads/bulk
- GET /api/sync
- GET /api/sync/stats
- GET /api/export/csv
- POST /api/integrations/webhook
- POST /api/integrations/pull
- GET /api/integrations/status
- GET /api/health

## Vercel Deployment
1. Push the repository.
2. Import the project in Vercel.
3. Add environment variables in Vercel Project Settings:
- DATABASE_URL
- WEBHOOK_SECRET
- API_SECRET_TOKEN (optional)
- Connector env vars (optional)
4. Deploy.

## Security Notes
- Keep DATABASE_URL server-side only.
- Keep WEBHOOK_SECRET private and rotate if exposed.
- Keep API_SECRET_TOKEN enabled for scheduled/internal pull endpoints.

## License
Internal use — ARD Builders & Developers
