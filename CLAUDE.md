# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Social media content approval workflow system for BRJ Mídias. Manages three-stage review: internal team review → client approval → publish. Built with Next.js 14 App Router, PostgreSQL via Supabase, Prisma ORM, and NextAuth.js.

## Commands

```bash
npm run dev          # Start dev server on port 3000
npm run build        # prisma generate + next build
npm run lint         # ESLint
npm run db:seed      # Create default admin user
npm run db:migrate   # Run Prisma migrations (prisma migrate dev)
```

No test framework is configured.

## Architecture

### Route Structure

- `/admin/*` — Protected by NextAuth middleware (`src/middleware.ts`)
  - `/admin` — Dashboard: all campaigns sorted by urgency
  - `/admin/campaigns/[id]` — Campaign detail, content management
  - `/admin/clients` — Client CRUD
  - `/admin/planner` — Drag-drop calendar for scheduling posts
  - `/admin/programacao` — Post scheduling by client

- `/aprovar/[token]` — **Public** client approval page (token from `campaign.token`)
- `/revisar/[token]` — **Public** internal reviewer page (token from `campaign.internalToken`)

### API Routes (`src/app/api/`)

- `auth/[...nextauth]` — NextAuth handler
- `admin/campaigns/[id]/*` — Campaign CRUD, send/reopen/charge operations
- `admin/clients/[id]` — Client CRUD
- `approval/[token]` — Client approval GET/PATCH/POST
- `internal/[token]` — Internal review GET/PATCH
- `upload` / `upload-url` — File upload to Supabase Storage
- `drive/folder` — Google Drive integration
- `cron/cleanup` — Background job

### Data Model (Prisma)

```
User → auth only
Client → has many Campaign
Campaign → has many ContentItem, ApprovalItem, InternalReviewItem
ContentItem → individual post/reel/story/carousel-slide
ApprovalItem → client approval status per content
InternalReviewItem → internal team review status per content
```

**Campaign statuses**: `DRAFT → INTERNAL_REVIEW → INTERNAL_DONE → OPEN → CLOSED → PUBLISHED`

**Item statuses**: `PENDING | APPROVED | ADJUSTMENT | REJECTED`

**Carousel grouping**: Carousel slides share the same `groupId`. Single posts use a unique `groupId` equal to their own ID.

### Urgency Sorting (Dashboard)

Dashboard sorts campaigns by: internal adjustments > client adjustments > pending internal review > pending client approval > fully approved > draft.

### Key Library Files

- `src/lib/auth.ts` — NextAuth config; credentials from `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars (fallback: hardcoded)
- `src/lib/prisma.ts` — Singleton Prisma client (avoids hot-reload connection leaks)
- `src/lib/mail.ts` — Nodemailer HTML email templates
- `src/lib/supabase.ts` — Supabase admin client for storage operations

### Auth

NextAuth with credentials provider. Admin username/password come from env vars `ADMIN_USERNAME` and `ADMIN_PASSWORD`. All `/admin/*` routes require an active session. Client and internal reviewer pages are public, protected only by UUID tokens.

## Environment Variables

```
DATABASE_URL          # Supabase pooled connection
DIRECT_URL            # Supabase direct connection (for migrations)
NEXTAUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
ADMIN_EMAIL
ADMIN_USERNAME / ADMIN_PASSWORD
```

## UI Conventions

- Dark theme: `#0f0f0f` background, `white/10` borders
- Status colors: emerald (approved), amber (adjustment/pending), red (rejected), violet (internal)
- UI labels are in Brazilian Portuguese (aprovar, revisar, programação, PENDENTE, APROVADO, AJUSTE, REPROVADO)
- Components use `"use client"` for interactivity; data-fetching pages use `export const dynamic = "force-dynamic"`
- `@` path alias maps to `src/`
