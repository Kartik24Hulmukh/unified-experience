# Coding Conventions

## Code Style
- **Strict Typing:** TypeScript strict mode is heavily utilized.
- **Functional Programming:** Prevalent use of hooks and functional components on the frontend.
- **Monolithic Decoupling:** The backend employs Fastify plugins for separation of concerns and routes.
- **Zod Validation:** Form inputs and API requests must be validated with Zod before processing. The schemas should be shared between both client and server when possible.

## Error Handling
- **Frontend:** Handled by standard React Error Boundaries (`ErrorBoundary.tsx`, `FallbackUI.tsx`) and Toast notifications for user feedback. TanStack Query captures query errors and processes them globally when needed.
- **Backend:** A hierarchical `AppError` class structure exists under `server/src/errors/index.ts`. All API routes rely on centralized error mapping (400 for Validation, 401 for Auth, 422 for violations). 

## Naming Conventions
- Variables/Functions: `camelCase`
- Classes/Components: `PascalCase`
- Types/Interfaces: `PascalCase`
- Environment Variables: `UPPER_SNAKE_CASE`

## Security Practices
- JWT access tokens stored in memory only.
- Refresh tokens sent via `httpOnly`, `Secure` cookies.
- CSRF implementation and Helmet usage mandatory on Fastify.
- FSM constraints to enforce strict status pipelines.
