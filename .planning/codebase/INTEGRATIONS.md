# System Integrations

## Databases
- **Primary Relational Database:** PostgreSQL 15+
  - Handled via Prisma ORM (`@prisma/client` v6.x)
  - Leverages row-level locking, JSONB columns, advisory locks, partial indexes.
  - Used for maintaining Users, Listings, Requests, Disputes, AuditLogs, and Tokens.

## Authentication Providers
- **Google OAuth 2.0:** Server-side token verification using `google-auth-library`.
- **Email / Password:** Custom TOTP / Email OTP verification with `argon2` password hashing.

## Email Services
- **Resend:** For sending transactional emails.
- **Nodemailer:** Fallback/alternative email management plugin.

## Future/External Services
- **Railway / Render:** Targeted platform for staging deployments.
- **Hetzner / DigitalOcean:** Target VPS providers for production environments using Docker.
