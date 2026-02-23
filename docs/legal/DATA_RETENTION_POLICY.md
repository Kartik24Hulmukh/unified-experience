# BErozgar Data Retention Policy

Effective Date: February 21, 2026
Last Updated: February 21, 2026

This policy defines baseline retention for operational, security, and moderation data.

## 1. Retention Principles

- Retain the minimum data needed for reliability, security, and dispute integrity.
- Keep records required for abuse prevention and auditability.
- Remove or anonymize data when no longer required.

## 2. Suggested Retention Windows

Unless legal/institutional obligations require longer retention:

- User account profile data: for account lifetime; deleted/anonymized after closure request and review.
- Listings and request lifecycle records: 24 months from terminal state.
- Dispute records: 24 months after closure.
- Audit logs (admin and security actions): 24 months minimum.
- Rate-limit and short-lived abuse counters: 30-90 days.
- Idempotency artifacts: TTL-driven short retention (minutes to days).
- Refresh/session token records: until expiry/revocation plus up to 30 days for incident analysis.
- OTP records: short-lived; expired/used entries purged on schedule.

## 3. Deletion and Anonymization

On approved account deletion:
- Personal identifiers are removed or anonymized where possible.
- Integrity-critical historical records may be retained in minimized form.

## 4. Exceptions

Data may be retained longer for:
- Active investigations.
- Security incident response.
- Legal/regulatory obligations.
- Ongoing disputes.

## 5. Access Control

Retention and purge operations must be restricted to authorized admin/ops roles and logged via audit mechanisms.

## 6. Review Cycle

This policy should be reviewed at least once per semester or when major architecture/security changes occur.
