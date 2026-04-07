# Directory Structure

## Repository Layout
```
unified-experience/
├── ARCHITECTURE.md          # Comprehensive backend specification
├── docker-compose.*         # Docker setups for dev and production
├── nginx/                   # Reverse proxy config and SSL
├── src/                     # React Frontend source code
│   ├── assets/              # Static assets, fonts, icons
│   ├── components/          # Reusable React components (shadcn UI, custom)
│   ├── contexts/            # React contexts (AuthContext, etc.)
│   ├── domain/              # Frontend domain tools/types
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility functions, GSAP init, API client
│   ├── pages/               # Top-level route components
│   └── services/            # Frontend services (mock DB stuff or real client endpoints)
├── server/                  # Fastify Backend source code
│   ├── prisma/              # Prisma DB schemas and migrations
│   ├── src/
│   │   ├── config/          # Environment variables and constants
│   │   ├── plugins/         # Fastify plugins (cors, auth, etc.)
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Backend business logic
│   │   ├── domain/          # FSM, rules, and engines (trust, fraud)
│   │   ├── middleware/      # Hooks for auth/validation
│   │   ├── lib/             # Shared tools (prisma singleton, jwt signing)
│   │   └── errors/          # Custom error classes
│   └── tests/               # Backend tests
└── shared/                  # Proposed future workspace for shared Zod validation and types
```

## Naming Conventions
- React Components use `PascalCase` (e.g., `ContextNav.tsx`).
- Utility functions, services, and hooks use `camelCase` (e.g., `trustEngine.ts`, `useAuth.tsx`).
- Configuration and definition modules generally use `kebab-case` or `camelCase` (e.g., `auth.routes.ts`, `api-client.ts`).
- Markdown and documentation fall back to `UPPERCASE` or `Title-Case` (e.g., `ARCHITECTURE.md`).
