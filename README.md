# LifeOS — Intelligent Productivity & Schedule Management Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.1-lightgrey?logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.7-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

**LifeOS** is an all-in-one personal operating system designed to streamline your daily workflow, schedule, and tasks. Featuring AI-powered schedule extraction, recurring event management, dynamic reminders, and a unified command dashboard, LifeOS transforms unstructured routines into actionable, organized productivity.

---

## Key Features

- **Centralized Command Dashboard**: Real-time snapshot of your daily agenda, pending tasks, overdue reminders, and activity metrics.
- **AI-Driven Schedule Parsing**: Extract structured calendar items, events, and tasks from unstructured text or uploaded syllabus/meeting notes using Google Gemini.
- **Draft & Review Workflow**: Review and edit AI-extracted items before confirming them into your primary calendar.
- **Advanced Calendar & Scheduling**: Support for full-day events, precise time slots, custom recurrence rules (daily, weekly, monthly, yearly), and priority tagging.
- **Task & Priority Tracking**: Organize tasks with granular status (`PENDING`, `COMPLETED`, `OVERDUE`, `CANCELLED`) and priority levels (`LOW`, `MEDIUM`, `HIGH`).
- **Automated Notifications & Reminders**: Configurable reminder offsets with automated alerts for upcoming and overdue obligations.
- **Modern Security Architecture**: Protected with JWT authentication, secure HTTP-only cookies, and PostgreSQL Row-Level Security (RLS).
- **Containerized Deployment**: Ready for development and production with Docker and Docker Compose.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | [Next.js 16 (App Router)](https://nextjs.org/), [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Lucide Icons](https://lucide.dev/) |
| **Backend** | [Node.js](https://nodejs.org/), [Express 5](https://expressjs.com/), [TypeScript](https://www.typescriptlang.org/), [Zod](https://zod.dev/) |
| **Database & ORM** | [PostgreSQL 16](https://www.postgresql.org/), [Prisma ORM 6](https://www.prisma.io/), [Supabase](https://supabase.com/) |
| **AI Integration** | [Google Gemini API](https://ai.google.dev/) / Vercel AI Gateway |
| **DevOps & Tooling** | [Docker](https://www.docker.com/), [Docker Compose](https://docs.docker.com/compose/), [pnpm](https://pnpm.io/) |

---

## Project Structure

```text
lifeos/
├── app/                        # Next.js App Router (pages & layouts)
│   ├── ai-import/              # AI schedule parser interface
│   ├── auth/                   # Authentication callback & reset flows
│   ├── calendar/               # Interactive calendar view
│   ├── dashboard/              # Main analytics & agenda dashboard
│   ├── login/ & register/      # User authentication screens
│   ├── notifications/          # Alerts and notification feed
│   ├── settings/               # User profile & preferences
│   └── tasks/                  # Task board & list view
├── components/                 # Reusable UI & feature components
│   ├── ui/                     # Primitives (buttons, inputs, dialogs)
│   ├── ai-import-page.tsx      # AI draft inspection & confirmation
│   ├── auth-form.tsx           # Authentication forms
│   └── lifeos-app.tsx          # Main application shell & navigation
├── backend/                    # Express backend service
│   ├── prisma/                 # Database schema & migrations
│   │   └── schema.prisma       # Data models (User, CalendarItem, etc.)
│   ├── src/
│   │   ├── config/             # Prisma & application configurations
│   │   ├── controllers/        # Route controllers (Auth, AI, Calendar, etc.)
│   │   ├── middleware/         # Auth, validation, and error handlers
│   │   ├── routes/             # API route declarations
│   │   └── server.ts           # Server entrypoint
│   └── Dockerfile              # Backend container image
├── lib/                        # Client-side API clients & utilities
├── docker-compose.yml          # Multi-service local environment setup
└── Dockerfile                  # Next.js frontend container image
```

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your local machine:
- [Node.js](https://nodejs.org/) (version 20 or higher)
- [pnpm](https://pnpm.io/) (version 9 or 10 recommended)
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/) (optional, for containerized run)

---

### Installation & Local Setup

#### 1. Clone the repository
```bash
git clone https://github.com/sakibfahad10/lifeos.git
cd lifeos
```

#### 2. Install dependencies
```bash
# Install root (frontend) dependencies
pnpm install

# Install backend dependencies
pnpm --dir backend install
```

#### 3. Configure Environment Variables
Create `.env` files in both the project root and `backend/`:

**Frontend (`.env`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**Backend (`backend/.env`):**
```env
PORT=4000
DATABASE_URL="postgresql://lifeos:lifeos-dev-password@localhost:5432/lifeos?schema=public"
DIRECT_URL="postgresql://lifeos:lifeos-dev-password@localhost:5432/lifeos?schema=public"
JWT_SECRET=your-secure-jwt-secret
GEMINI_API_KEY=your-google-gemini-api-key
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

#### 4. Run Database Migrations
```bash
# Generate Prisma Client
pnpm --dir backend db:generate

# Apply migrations
pnpm --dir backend db:migrate
```

#### 5. Start Development Servers

You can run both services concurrently:

```bash
# Terminal 1: Backend API (runs on port 4000)
pnpm --dir backend dev

# Terminal 2: Frontend App (runs on port 3000)
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to access LifeOS.

---

### Running with Docker Compose

To launch the complete stack (PostgreSQL, Backend API, and Next.js Frontend) with a single command:

```bash
docker compose up --build
```

The services will be mapped as follows:
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- **PostgreSQL**: `localhost:5432`

---

## API Overview

All backend endpoints are prefixed with `/api/v1`:

| Route | Methods | Description |
|---|---|---|
| `/auth` | `POST /register`, `POST /login`, `POST /logout`, `GET /me` | Authentication and user session management |
| `/dashboard` | `GET /` | Aggregated statistics, today's schedule, and pending items |
| `/calendar` | `GET`, `POST`, `PUT /:id`, `DELETE /:id` | Calendar event and recurring schedule CRUD |
| `/tasks` | `GET`, `POST`, `PATCH /:id/status`, `DELETE /:id` | Task tracking and priority management |
| `/ai` | `POST /import`, `POST /import/:id/confirm` | AI schedule extraction and draft confirmation |
| `/notifications`| `GET`, `PATCH /:id/read`, `DELETE /:id` | Notification management and reminder triggers |
| `/users` | `GET /profile`, `PUT /settings` | User profile updates and app configuration |

---

## Security & Best Practices

- **Row-Level Security (RLS)**: Enabled across all public PostgreSQL tables to prevent unauthorized access via client-side Supabase tokens.
- **Environment Confidentiality**: Secret keys and sensitive credentials (`.env`, `.env.local`) are ignored by Git and never committed to version control.
- **Data Validation**: Strict runtime schema validation on all incoming API requests using Zod.
- **Scoped Authentication**: Route-level JWT middleware verification to enforce per-user isolation across all entities.

---

## License

This project is private and proprietary. All rights reserved.
