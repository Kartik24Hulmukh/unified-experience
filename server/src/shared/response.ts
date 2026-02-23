/**
 * BErozgar — Response Helpers
 *
 * Standardized API response envelope and enum normalization.
 * Ensures the frontend receives consistent { data, meta? } shapes
 * with lowercase status/role enum values matching the React type contracts.
 *
 * Usage in routes:
 *   reply.send(apiData(entity))        → { data: entity }
 *   reply.send(apiPage(items, pag))    → { data: items, meta: { page, perPage, total } }
 *   reply.send(normalize(authPayload)) → auth responses (no envelope)
 */

/* ═══════════════════════════════════════════════════
   Known Prisma Enum Values (whitelist)
   ═══════════════════════════════════════════════════ */

/**
 * Only these exact uppercase values get lowercased.
 * This prevents unintended lowercasing of domain values
 * like TrustStatus ('GOOD_STANDING') or privilege levels.
 */
const DB_ENUMS = new Set([
  // ListingStatus
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'INTEREST_RECEIVED',
  'COMPLETED',
  'REMOVED',
  // RequestStatus
  'IDLE',
  'SENT',
  'ACCEPTED',
  'DECLINED',
  'MEETING_SCHEDULED',
  'EXPIRED',
  'CANCELLED',
  'WITHDRAWN',
  'DISPUTED',
  'RESOLVED',
  // UserRole
  'STUDENT',
  'ADMIN',
  // DisputeStatus
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'REJECTED',
  'ESCALATED',
  // DisputeType
  'FRAUD',
  'ITEM_NOT_AS_DESCRIBED',
  'NO_SHOW',
  'OTHER',
  // PrivilegeLevel
  'STANDARD',
  'SUPER',
]);

/** Fields whose values may be Prisma enums */
const ENUM_KEYS = new Set(['status', 'role', 'type', 'privilegeLevel']);

/* ═══════════════════════════════════════════════════
   Recursive Normalizer
   ═══════════════════════════════════════════════════ */

/**
 * Recursively traverse an object/array and lowercase known enum field values.
 * Safe to call on any payload — non-matching values pass through unchanged.
 */
export function normalize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(normalize);
  if (typeof obj !== 'object') return obj;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (
      ENUM_KEYS.has(key) &&
      typeof value === 'string' &&
      DB_ENUMS.has(value)
    ) {
      result[key] = value.toLowerCase();
    } else if (value instanceof Date) {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.map(normalize);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = normalize(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/* ═══════════════════════════════════════════════════
   Envelope Helpers
   ═══════════════════════════════════════════════════ */

interface PaginationInput {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Wrap a single entity or raw data in `{ data }` envelope
 * with recursive enum normalization.
 *
 * Matches the frontend `ApiResponse<T>` type.
 */
export function apiData<T>(data: T) {
  return { data: normalize(data) };
}

/**
 * Wrap paginated results in `{ data, meta }` envelope
 * with recursive enum normalization.
 *
 * Matches the frontend `ApiResponse<T>` with meta.
 */
export function apiPage<T>(items: T[], pagination: PaginationInput) {
  return {
    data: normalize(items),
    meta: {
      page: pagination.page,
      perPage: pagination.limit,
      total: pagination.total,
    },
  };
}
