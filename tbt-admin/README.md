# TBT Admin Platform

Production-ready admin application for Tamil Business Tribe (TBT) mobile LMS platform.

## Project Overview
This monorepo contains the administrative panel and backend API for managing TBT's LMS, Task Management, Community, and Webinar modules.

## Tech Stack

### Admin Panel (Web)
- **Framework:** Next.js 14 (App Router)
- **Authentication:** Clerk
- **State Management:** Zustand
- **Data Fetching:** TanStack Query
- **Styling:** Tailwind CSS + shadcn/ui
- **Validation:** Zod

### Backend API
- **Runtime:** Node.js + TypeScript
- **Framework:** Fastify
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **Real-time:** Socket.io
- **Job Queue:** BullMQ + Redis (Upstash)
- **Services:** Agora.io (Webinar), Resend (Email), Twilio (SMS), Cloudflare R2 (Storage), Bunny Stream (Video)

## Project Structure
```
/tbt-admin
  /admin-panel    # Next.js Application
  /backend        # Fastify API
  /package.json   # Root monorepo config
```

## Local Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL
- Redis

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Setup environment variables:
   - Copy `admin-panel/.env.example` to `admin-panel/.env.local`
   - Copy `backend/.env.example` to `backend/.env`
   - Fill in all required keys.

4. Generate Prisma client:
   ```bash
   npm run prepare
   ```

5. Start development servers:
   ```bash
   # Both servers
   npm run dev:admin
   npm run dev:backend
   ```

### Initial Setup (Super Admin)
To create the initial Super Admin account:
1. Ensure your database is migrated.
2. Run the seed command in the `backend` directory:
   ```bash
   cd backend
   npx prisma db seed
   ```
3. **Important**: Since this project uses Clerk for authentication, you must also manually create a user in your **Clerk Dashboard** with the username `sakthi` and password `admin123` to match the seeded database record.

## API Documentation
- Health Check: `GET /health`
- API Prefix: `/api`
- Protected Routes: Require Clerk JWT in `Authorization: Bearer <token>` header.

## Deployment Guide

### Backend (Railway)
1. Link your Railway project.
2. Add all environment variables from `.env.example`.
3. Deployment is automated via GitHub Actions.

### Admin Panel (Vercel)
1. Import the repository in Vercel.
2. Set root directory to `admin-panel`.
3. Add environment variables.
4. Deployment is automated via GitHub Actions.

## Monitoring & Tracking
- **Error Tracking:** Sentry
- **Logging:** Better Stack
- **Database Logs:** Supabase Dashboard
