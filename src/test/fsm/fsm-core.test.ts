/**
 * FSM Core Infrastructure Tests
 *
 * Validates:
 *   - Valid transitions produce correct next state
 *   - Invalid transitions throw InvalidTransitionError
 *   - Terminal states reject all events
 *   - Snapshot resume works correctly
 *   - History is accurately tracked
 *   - can() and availableEvents() are consistent
 *   - Immutability guarantees
 */

import { describe, it, expect } from 'vitest';
import {
  createMachine,
  InvalidTransitionError,
  type MachineDefinition,
} from '@/lib/fsm/types';

/* ── Minimal test machine ──────────────────────────────────── */

type TestState = 'A' | 'B' | 'C';
type TestEvent = 'GO' | 'JUMP' | 'STOP';

const TestDefinition: MachineDefinition<TestState, TestEvent> = {
  id: 'TestMachine',
  initial: 'A',
  transitions: {
    A: { GO: 'B', JUMP: 'C' },
    B: { STOP: 'C' },
    // C is terminal
  },
};

describe('FSM Core: createMachine', () => {
  it('starts in the initial state', () => {
    const m = createMachine(TestDefinition);
    expect(m.state).toBe('A');
    expect(m.history).toHaveLength(0);
  });

  it('transitions to the correct state on valid event', () => {
    const m = createMachine(TestDefinition);
    const next = m.send('GO');
    expect(next.state).toBe('B');
  });

  it('tracks history accurately', () => {
    const m = createMachine(TestDefinition);
    const b = m.send('GO');
    const c = b.send('STOP');
    expect(c.history).toEqual([
      ['GO', 'A', 'B'],
      ['STOP', 'B', 'C'],
    ]);
  });

  it('throws InvalidTransitionError on invalid event', () => {
    const m = createMachine(TestDefinition);
    expect(() => m.send('STOP')).toThrow(InvalidTransitionError);
  });

  it('throws on events from terminal state', () => {
    const m = createMachine(TestDefinition);
    const c = m.send('JUMP'); // A -> C (terminal)

    expect(() => c.send('GO')).toThrow(InvalidTransitionError);
    expect(() => c.send('JUMP')).toThrow(InvalidTransitionError);
    expect(() => c.send('STOP')).toThrow(InvalidTransitionError);
  });

  it('original instance is unchanged after send() (immutability)', () => {
    const m = createMachine(TestDefinition);
    const next = m.send('GO');
    expect(m.state).toBe('A');
    expect(m.history).toHaveLength(0);
    expect(next.state).toBe('B');
  });
});

describe('FSM Core: can()', () => {
  it('returns true for valid events', () => {
    const m = createMachine(TestDefinition);
    expect(m.can('GO')).toBe(true);
    expect(m.can('JUMP')).toBe(true);
  });

  it('returns false for invalid events', () => {
    const m = createMachine(TestDefinition);
    expect(m.can('STOP')).toBe(false);
  });

  it('returns false for all events from terminal state', () => {
    const m = createMachine(TestDefinition).send('JUMP');
    expect(m.can('GO')).toBe(false);
    expect(m.can('JUMP')).toBe(false);
    expect(m.can('STOP')).toBe(false);
  });
});

describe('FSM Core: availableEvents()', () => {
  it('lists all valid events from current state', () => {
    const m = createMachine(TestDefinition);
    const events = m.availableEvents();
    expect(events).toContain('GO');
    expect(events).toContain('JUMP');
    expect(events).toHaveLength(2);
  });

  it('returns empty array from terminal state', () => {
    const m = createMachine(TestDefinition).send('JUMP');
    expect(m.availableEvents()).toEqual([]);
  });
});

describe('FSM Core: Snapshot Resume', () => {
  it('resumes from a given state', () => {
    const m = createMachine(TestDefinition, { state: 'B', history: [] });
    expect(m.state).toBe('B');
    expect(m.can('STOP')).toBe(true);
    expect(m.can('GO')).toBe(false);
  });

  it('resumes with existing history', () => {
    const history: ReadonlyArray<readonly [TestEvent, TestState, TestState]> = [
      ['GO', 'A', 'B'],
    ];
    const m = createMachine(TestDefinition, { state: 'B', history });
    const c = m.send('STOP');
    expect(c.history).toHaveLength(2);
    expect(c.history[0]).toEqual(['GO', 'A', 'B']);
    expect(c.history[1]).toEqual(['STOP', 'B', 'C']);
  });
});

describe('FSM Core: InvalidTransitionError', () => {
  it('includes machine name, state, and event in error', () => {
    const m = createMachine(TestDefinition);
    try {
      m.send('STOP');
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidTransitionError);
      const err = e as InvalidTransitionError;
      expect(err.machine).toBe('TestMachine');
      expect(err.from).toBe('A');
      expect(err.event).toBe('STOP');
      expect(err.message).toContain('TestMachine');
      expect(err.message).toContain('STOP');
      expect(err.message).toContain('A');
    }
  });
});
