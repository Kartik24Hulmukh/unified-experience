import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: { get: mocks.get } }));
import { AdminCampusQaMetrics } from '@/components/AdminCampusQaMetrics';
const week = { weekStart: '2026-09-28', answered: 3, unanswered: 1, total: 4, reopened: 2, observedDays: 1, partial: true, answerRate: 0.75 };
const payload = { since: '2026-09-28T00:00:00.000Z', until: '2026-09-29T00:00:00.000Z', timezone: 'UTC', methodology: 'Server observations, not unique students.', weeks: [week] };
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><AdminCampusQaMetrics /></QueryClientProvider>);
}
beforeEach(() => vi.resetAllMocks());
describe('admin weekly evidence UI', () => {
  it('announces loading without painting fabricated zeros', () => {
    mocks.get.mockReturnValue(new Promise(() => {})); open();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('renders the chart, exact counts, partial label and methodology', async () => {
    mocks.get.mockResolvedValue({ data: payload }); open();
    expect(await screen.findByRole('table')).toHaveTextContent('2026-09-28 (partial)');
    expect(screen.getByRole('table')).toHaveTextContent('75.0%');
    expect(screen.getByRole('img')).toHaveAccessibleName(/Weekly answered-question rate/);
    expect(screen.getByText(payload.methodology)).toBeInTheDocument();
    expect(mocks.get.mock.calls[0][0]).toBe('/admin/campus-qa/metrics?weeks=8');
  });
  it('keeps the no-observation state distinct from 0% success', async () => {
    mocks.get.mockResolvedValue({ data: { ...payload, weeks: [{ ...week, answered: 0, unanswered: 0, total: 0, answerRate: null }] } }); open();
    expect(await screen.findByText(/No recorded questions/)).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('No observations');
  });
  it('shows failed requests honestly and allows a successful retry', async () => {
    mocks.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: payload }); open();
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh metrics' }));
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('treats a malformed success response as an error instead of a blank chart', async () => {
    mocks.get.mockResolvedValue({ data: {} }); open();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
