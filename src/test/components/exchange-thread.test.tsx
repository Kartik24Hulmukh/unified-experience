import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ send: vi.fn(), query: { data: { pages: [{ data: { messages: [], nextCursor: null } }] }, isPending: false, isError: false, hasNextPage: false, refetch: vi.fn() } }));
vi.mock('@/hooks/api/useApi', () => ({
  useExchangeMessages: () => mock.query,
  useSendExchangeMessage: () => ({ mutateAsync: mock.send, isPending: false, isError: false }),
}));
import { ExchangeThread } from '@/components/ExchangeThread';
beforeEach(() => { vi.clearAllMocks(); });
function open(status = 'ACCEPTED') {
  render(<ExchangeThread requestId="request" userId="buyer" status={status} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open conversation' }));
}
describe('Exchange conversation UI', () => {
  it('is opt-in and explains visibility and meeting safety', () => {
    open(); expect(screen.getByText(/Participants and campus administrators/)).toBeInTheDocument();
    expect(screen.getByLabelText('Message your exchange partner')).toHaveAttribute('maxLength', '2000');
  });
  it('retains text and stable retry identity on failure, then clears on success', async () => {
    mock.send.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
    open(); const input = screen.getByLabelText('Message your exchange partner');
    fireEvent.change(input, { target: { value: 'Meet at library?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(1));
    expect(input).toHaveValue('Meet at library?');
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(mock.send.mock.calls[0][0]).toEqual(mock.send.mock.calls[1][0]);
  });
  it.each(['COMPLETED', 'CANCELLED', 'DISPUTED'])('renders %s threads as read-only', status => {
    open(status); expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('read-only');
  });
});
