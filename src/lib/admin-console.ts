import type { AuditLogEntry, Dispute, FraudDashboardData, PendingItem } from '@/hooks/api/useApi';

export type AdminTab = 'pending' | 'users' | 'disputes' | 'fraud' | 'logs' | 'activity';

function includesQuery(parts: Array<string | undefined>, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return parts.some((part) => part?.toLowerCase().includes(normalized));
}

export function getAdminSearchConfig(activeTab: AdminTab): { enabled: boolean; placeholder: string } {
  switch (activeTab) {
    case 'pending':
      return { enabled: true, placeholder: 'Search pending listings...' };
    case 'users':
      return { enabled: true, placeholder: 'Search users by name or email...' };
    case 'disputes':
      return { enabled: true, placeholder: 'Search disputes...' };
    case 'logs':
      return { enabled: true, placeholder: 'Search audit logs...' };
    case 'fraud':
      return { enabled: true, placeholder: 'Search fraud flags...' };
    default:
      return { enabled: false, placeholder: 'Search unavailable on this tab' };
  }
}

export function filterAdminPendingListings(items: PendingItem[], query: string): PendingItem[] {
  return items.filter((item) =>
    includesQuery([item.id, item.title, item.owner?.fullName, item.owner?.email, item.status], query),
  );
}

export function filterAdminDisputes(items: Dispute[], query: string): Dispute[] {
  return items.filter((item) =>
    includesQuery([item.id, item.type, item.status, item.description, item.raisedById, item.againstId], query),
  );
}

export function filterAdminAuditLogs(items: AuditLogEntry[], query: string): AuditLogEntry[] {
  return items.filter((item) =>
    includesQuery([item.id, item.action, item.actorId, item.actorRole, item.targetType, item.targetId, item.details], query),
  );
}

export function filterAdminFraudUsers(
  items: FraudDashboardData['flaggedUsers'],
  query: string,
): FraudDashboardData['flaggedUsers'] {
  return items.filter((item) =>
    includesQuery([
      item.userId,
      item.email,
      item.fullName,
      item.riskLevel,
      item.trust,
      ...item.flags,
    ], query),
  );
}