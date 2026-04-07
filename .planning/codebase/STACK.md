# Codebase Tech Stack

## Core Technologies
- **Frontend Runtime:** Browser / React 18
- **Backend Runtime:** Node.js 20 LTS
- **Language:** TypeScript 5.x (Strict Mode)

## Frontend Ecosystem
- **Framework:** React 18 + Vite (configured for SWC)
- **State Management & Data Fetching:** TanStack Query `^5.83.0`
- **Styling:** Tailwind CSS `^3.4.17` + shadcn-ui + class-variance-authority + clsx + tailwind-merge
- **UI Components:** Radix UI primitives
- **Animation:** GSAP `^3.14.2` + Framer Motion + Lenis (for smooth scrolling)
- **Forms & Validation:** React Hook Form + Zod `^3.25.76` + @hookform/resolvers
- **3D Graphics/WebXR:** Three.js `^0.170.0` + @react-three/fiber + @react-three/drei + @react-three/rapier

## Backend Ecosystem (Server)
- **Framework:** Fastify 5 + fastify-plugin
- **Security:** @fastify/helmet, @fastify/cors, @fastify/rate-limit
- **Database ORM:** Prisma `^6.3.1`
- **Validation:** Zod (shared with frontend)
- **Authentication:** jsonwebtoken, google-auth-library, argon2 (for password hashing)
- **Email:** Nodemailer, Resend
- **Logging:** Pino + pino-pretty

## Configuration Management
- **Environment:** Managed via standard `.env` files (e.g. `.env`, `.env.development`, `.env.production`). Backend has its own `.env.example`.
- **Containers:** Docker and Docker Compose (`docker-compose.yml`, `docker-compose.prod.yml`) for DB, API, and Nginx.
- **Reverse Proxy:** Nginx for SSL, rate limiting, and static file serving.
