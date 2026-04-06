import { describe, expect, it } from 'vitest';

import {
  canRunAdminRecovery,
  getExchangeRequestActions,
  partitionExchangeRequests,
  shouldRedirectVerifyPageToSignup,
} from '@/lib/user-journey';
import type { ExchangeRequest } from '@/hooks/api/useApi';

function makeRequest(overrides: Partial<ExchangeRequest> = {}): ExchangeRequest {
  return {
    id: 'req-1',
    listingId: 'listing-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    status: 'SENT',
    message: 'Interested',
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('user journey helpers', () => {
  it('does not redirect verify page before auth hydration completes', () => {
    expect(
      shouldRedirectVerifyPageToSignup({
        hasPendingSignup: false,
        isAuthenticated: false,
        isHydrated: false,
      }),
    ).toBe(false);
  });

  it('redirects verify page to signup only after hydration confirms no pending signup and no session', () => {
    expect(
      shouldRedirectVerifyPageToSignup({
        hasPendingSignup: false,
        isAuthenticated: false,
        isHydrated: true,
      }),
    ).toBe(true);
  });

  it('keeps completed exchanges in history instead of dropping them from profile', () => {
    const requests = [
      makeRequest({ id: 'active-1', status: 'ACCEPTED' }),
      makeRequest({ id: 'history-1', status: 'COMPLETED' }),
      makeRequest({ id: 'history-2', status: 'DECLINED' }),
    ];

    const { activeRequests, historyRequests } = partitionExchangeRequests(requests);

    expect(activeRequests.map((request) => request.id)).toEqual(['active-1']);
    expect(historyRequests.map((request) => request.id)).toEqual(['history-1', 'history-2']);
  });

  it('offers dispute action for completed requests when the user is a party', () => {
    const request = makeRequest({ status: 'COMPLETED' });

    expect(getExchangeRequestActions(request, 'buyer-1').map((action) => action.event)).toContain('DISPUTE');
    expect(getExchangeRequestActions(request, 'seller-1').map((action) => action.event)).toContain('DISPUTE');
  });

  it('only allows super admins to run recovery from the console', () => {
    expect(canRunAdminRecovery('SUPER')).toBe(true);
    expect(canRunAdminRecovery('REVIEWER')).toBe(false);
    expect(canRunAdminRecovery('OBSERVER')).toBe(false);
    expect(canRunAdminRecovery(undefined)).toBe(false);
  });
});
