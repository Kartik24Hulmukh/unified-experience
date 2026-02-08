/**
 * Finite State Machine — core infrastructure.
 *
 * Pure domain logic. No UI, no React, no side-effects.
 * Every machine is a sealed transition table: if a transition
 * is not explicitly defined, it throws.
 */

/* ── Transition table type ─────────────────────────────────── */

/**
 * A mapping of `{ [CurrentState]: { [Event]: NextState } }`.
 * Only defined pairs are valid — everything else is an illegal transition.
 */
export type TransitionTable<
  S extends string,
  E extends string,
> = Partial<Record<S, Partial<Record<E, S>>>>;

/* ── Machine definition ────────────────────────────────────── */

export interface MachineDefinition<
  S extends string,
  E extends string,
> {
  /** Human-readable machine name (for error messages). */
  readonly id: string;
  /** The state every new instance starts in. */
  readonly initial: S;
  /** Sealed transition table. */
  readonly transitions: TransitionTable<S, E>;
}

/* ── Machine instance ──────────────────────────────────────── */

export interface MachineInstance<
  S extends string,
  E extends string,
> {
  /** Current state. */
  readonly state: S;
  /** Ordered history of `[event, fromState, toState]` tuples. */
  readonly history: ReadonlyArray<readonly [E, S, S]>;
  /** Dispatch an event — returns a **new** instance (immutable). */
  send(event: E): MachineInstance<S, E>;
  /** Check whether an event is valid from the current state. */
  can(event: E): boolean;
  /** Return all events valid from the current state. */
  availableEvents(): E[];
}

/* ── InvalidTransitionError ────────────────────────────────── */

export class InvalidTransitionError extends Error {
  readonly machine: string;
  readonly from: string;
  readonly event: string;

  constructor(machine: string, from: string, event: string) {
    super(
      `[${machine}] Invalid transition: cannot apply "${event}" in state "${from}".`,
    );
    this.name = 'InvalidTransitionError';
    this.machine = machine;
    this.from = from;
    this.event = event;
  }
}

/* ── createMachine ─────────────────────────────────────────── */

/**
 * Instantiate a machine from its definition.
 * Returns an immutable instance — every `send()` yields a new object.
 */
export function createMachine<S extends string, E extends string>(
  definition: MachineDefinition<S, E>,
  /** Optionally resume from a prior state + history. */
  snapshot?: { state: S; history: ReadonlyArray<readonly [E, S, S]> },
): MachineInstance<S, E> {
  const state = snapshot?.state ?? definition.initial;
  const history = snapshot?.history ?? [];

  function can(event: E): boolean {
    const row = definition.transitions[state];
    return row !== undefined && event in row;
  }

  function availableEvents(): E[] {
    const row = definition.transitions[state];
    if (!row) return [];
    return (Object.keys(row) as E[]).filter(
      (e) => row[e] !== undefined,
    );
  }

  function send(event: E): MachineInstance<S, E> {
    const row = definition.transitions[state];
    const next = row?.[event];

    if (next === undefined) {
      throw new InvalidTransitionError(definition.id, state, event);
    }

    return createMachine(definition, {
      state: next,
      history: [...history, [event, state, next] as const],
    });
  }

  return Object.freeze({ state, history, send, can, availableEvents });
}
