import { describe, expect, it } from 'vitest';
import { normalizeExchangeRequest, type ExchangeRequest } from '@/hooks/api/useApi';
import { getExchangeRequestActions, partitionExchangeRequests } from '@/lib/user-journey';
describe('Exchange HTTP status normalization', () => {
  it('keeps accepted wire responses in Active with actionable controls', () => {
    const raw = { id: 'request', buyerId: 'buyer', sellerId: 'seller', status: 'accepted' } as unknown as ExchangeRequest;
    const request = normalizeExchangeRequest(raw);
    expect(request.status).toBe('ACCEPTED');
    expect(partitionExchangeRequests([request]).activeRequests).toHaveLength(1);
    expect(getExchangeRequestActions(request, 'seller').map(a => a.event)).toContain('SCHEDULE');
    expect(raw.status).toBe('accepted');
  });
});
