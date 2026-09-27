/**
 * HelpPage withdrawal regression (APODEX continuation n)
 *
 * Locks the client half of the corpus-withdrawal contract: the help page
 * must NEVER keep serving an answer that has been withdrawn after it was
 * first shown. Every expand re-asks the live (no-store) answer API, and a
 * matched:false response replaces the stale paragraph on screen.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HelpPage from '@/pages/HelpPage';

const mockAsk = vi.fn();
const mockFetchQuestions = vi.fn();

vi.mock('@/lib/campus-qa', async () => {
  const actual = await vi.importActual<typeof import('@/lib/campus-qa')>('@/lib/campus-qa');
  return {
    ...actual,
    askCampusQuestion: (...args: unknown[]) => mockAsk(...args),
    fetchCampusQuestions: (...args: unknown[]) => mockFetchQuestions(...args),
  };
});

const QUESTION = {
  id: 'reviewed-xerox-shop-1234abcd',
  question: 'Where can I get photocopies near RGIT?',
  topic: 'directory',
  source: 'docs/CAMPUS_GUIDE.md',
};

const MATCHED = {
  matched: true,
  confidence: 0.91,
  query: QUESTION.question,
  answer: 'The xerox counter is at the stationery shop by the main gate, open 9am to 7pm.',
  entry: { id: QUESTION.id, question: QUESTION.question, topic: 'directory', source: QUESTION.source },
  related: [],
  disclaimer: 'Reviewed answers only.',
};

const WITHDRAWN = {
  matched: false,
  confidence: 0.02,
  query: QUESTION.question,
  answer: null,
  entry: null,
  related: [],
  disclaimer: 'Reviewed answers only.',
};

describe('HelpPage withdrawal regression', () => {
  beforeEach(() => {
    mockAsk.mockReset();
    mockFetchQuestions.mockReset();
    mockFetchQuestions.mockResolvedValue([QUESTION]);
  });

  it('expanding a question always re-asks the live API and replaces a withdrawn answer', async () => {
    mockAsk.mockResolvedValueOnce(MATCHED);
    render(
      <HelmetProvider>
        <MemoryRouter>
          <HelpPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    // 1. First expand: the reviewed answer renders with its citation.
    const toggle = await screen.findByRole('button', { name: new RegExp(QUESTION.question) });
    fireEvent.click(toggle);
    expect(await screen.findByText(MATCHED.answer)).toBeTruthy();
    expect(screen.getByText(`Source: ${QUESTION.source}`)).toBeTruthy();

    // Collapse, then the admin unpublishes the answer.
    fireEvent.click(toggle);
    mockAsk.mockResolvedValueOnce(WITHDRAWN);

    // 2. Re-expand: the page must NOT reuse the in-memory copy. It asks the
    //    live API again, and the withdrawn answer disappears from the screen.
    fireEvent.click(toggle);
    await waitFor(() => expect(mockAsk).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(MATCHED.answer)).toBeNull());
    expect(screen.getByText(/Answer unavailable right now/)).toBeTruthy();
  });

  it('shows a pending state on every expand, even when an answer was cached in memory', async () => {
    let resolveSecond: ((v: unknown) => void) | null = null;
    mockAsk
      .mockResolvedValueOnce(MATCHED)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    render(
      <HelmetProvider>
        <MemoryRouter>
          <HelpPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    const toggle = await screen.findByRole('button', { name: new RegExp(QUESTION.question) });
    fireEvent.click(toggle);
    expect(await screen.findByText(MATCHED.answer)).toBeTruthy();

    fireEvent.click(toggle); // collapse
    fireEvent.click(toggle); // re-expand with a slow request

    // While the fresh request is in flight the stale paragraph is hidden,
    // so a withdrawn answer can never linger during the refetch.
    expect(await screen.findByText(/Fetching reviewed answer/)).toBeTruthy();
    expect(screen.queryByText(MATCHED.answer)).toBeNull();

    resolveSecond!(WITHDRAWN);
    await waitFor(() => expect(screen.getByText(/Answer unavailable right now/)).toBeTruthy());
  });
});
