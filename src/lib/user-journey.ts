import type { AdminPrivilegeLevel } from '@/contexts/AuthContext';
import type { ExchangeRequest } from '@/hooks/api/useApi';

export interface ExchangeRequestAction {
  label: string;
  event: string;
  variant?: 'default' | 'destructive';
}

export function shouldRedirectVerifyPageToSignup(params: {
  hasPendingSignup: boolean;
  isAuthenticated: boolean;
  isHydrated: boolean;
}): boolean {
  return !params.hasPendingSignup && !params.isAuthenticated && params.isHydrated;
}

export function canRunAdminRecovery(level?: AdminPrivilegeLevel): boolean {
  return level === 'SUPER';
}

export function canModerateContent(level?: AdminPrivilegeLevel): boolean {
  return level === 'SUPER' || level === 'REVIEWER';
}

export function partitionExchangeRequests(requests: ExchangeRequest[]) {
  const activeStatuses: ExchangeRequest['status'][] = ['SENT', 'ACCEPTED', 'MEETING_SCHEDULED', 'DISPUTED'];

  return {
    activeRequests: requests.filter((request) => activeStatuses.includes(request.status)),
    historyRequests: requests.filter((request) => !activeStatuses.includes(request.status)),
  };
}

export function getExchangeRequestActions(
  request: ExchangeRequest,
  userId: string,
): ExchangeRequestAction[] {
  const isBuyer = request.buyerId === userId;
  const isSeller = request.sellerId === userId;

  if (request.status === 'SENT') {
    return [
      ...(isSeller
        ? [
            { label: 'Accept', event: 'ACCEPT' },
            { label: 'Decline', event: 'DECLINE', variant: 'destructive' as const },
          ]
        : []),
      ...(isBuyer ? [{ label: 'Withdraw', event: 'WITHDRAW', variant: 'destructive' as const }] : []),
    ];
  }

  if (request.status === 'ACCEPTED') {
    return [
      ...(isSeller ? [{ label: 'Schedule Meeting', event: 'SCHEDULE' }] : []),
      ...(isBuyer ? [{ label: 'Cancel', event: 'CANCEL', variant: 'destructive' as const }] : []),
      ...(isBuyer || isSeller ? [{ label: 'Report Dispute', event: 'DISPUTE', variant: 'destructive' as const }] : []),
    ];
  }

  if (request.status === 'MEETING_SCHEDULED') {
    return [
      { label: 'Mark Complete', event: 'CONFIRM' },
      ...(isBuyer || isSeller ? [{ label: 'Report Dispute', event: 'DISPUTE', variant: 'destructive' as const }] : []),
    ];
  }

  if (request.status === 'COMPLETED') {
    return isBuyer || isSeller
      ? [{ label: 'Report Dispute', event: 'DISPUTE', variant: 'destructive' as const }]
      : [];
  }

  return [];
}
