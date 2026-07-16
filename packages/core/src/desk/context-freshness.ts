/**
 * Context freshness: has the state file drifted from the records?
 *
 * Pure — no I/O, no clock. The answer depends only on the stamps handed in, so it is
 * deterministic and reasonable-about.
 *
 * The signal is **causal, not chronological**: "N records changed since the state file was last
 * written", never "the state is 14 days old". Age is not evidence of drift. A stable project with
 * a six-month-old state is fine; a busy one with a two-week-old state is not.
 *
 * Freshness is scoped to the STATE FILE alone, not to all of `context/`. The user's own context
 * files (the brief, hand-written notes) carry no maintenance promise, so their stamps say nothing
 * about whether the AI snapshot has seen the records — and counting them let editing an unrelated
 * context file mark a rotting state "fresh".
 */

/** Anything carrying the two frontmatter stamps: Doc, Task, Meeting. */
export interface Stamped {
  updated?: string;
  created?: string;
}

export type ContextFreshnessStatus = "empty" | "never" | "fresh" | "stale";

export interface ContextFreshness {
  status: ContextFreshnessStatus;
  /** The state file's raw stamp. For display only — never compare this lexicographically. */
  contextUpdated?: string;
  /** Records provably newer than the state file (all of them, when no state exists yet). */
  changedSince: number;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve a stamp to a `[lo, hi]` interval in epoch ms.
 *
 * This is the crux of the module. The two stamps in this codebase have **different
 * precision**: `updated` is a UTC datetime (`nowISO()`) while `created` is a local
 * calendar day (`todayISO()`), and `normalizeDateTime` passes a hand-written date-only
 * `updated` straight through. So precision is a property of the *string*, not of the field.
 *
 * Comparing them as strings is unsound in BOTH directions:
 *
 *  - A date-only string is a *prefix* of a datetime, so `"2026-07-13" < "2026-07-13T09:00Z"`.
 *    A record written at 18:00 carrying only `created` would read as older than a state file
 *    refreshed at 09:00 — drift silently reported as fresh. This is the dangerous direction.
 *  - At UTC+2, a record created 00:30 local on the 14th (`created: "2026-07-14"`, real instant
 *    `2026-07-13T22:30Z`) sorts after a state refreshed at `"2026-07-13T23:00Z"` — stale,
 *    though the snapshot is current.
 *
 * So a date-only stamp is treated as what it actually denotes: a whole **local** calendar day,
 * an interval rather than an instant. Callers then coerce each side to the bound that keeps the
 * answer safe (see below).
 */
function bounds(stamp?: string): { lo: number; hi: number } | undefined {
  if (!stamp) return undefined;

  if (DATE_ONLY.test(stamp)) {
    const [y, m, d] = stamp.split("-").map(Number);
    const lo = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
    const hi = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
    return Number.isNaN(lo) ? undefined : { lo, hi };
  }

  const t = Date.parse(stamp);
  return Number.isNaN(t) ? undefined : { lo: t, hi: t };
}

const stampOf = (x: Stamped): string | undefined => x.updated ?? x.created;

/**
 * The records provably newer than the state file, newest first — or ALL stamped records when no
 * state file exists yet (a project adopting the feature has a full history the first snapshot
 * must reconcile, not an empty diff).
 *
 * This is the single definition of "changed since the snapshot": the freshness count below is
 * this list's length, and the refresh sends this list's head to the model. Deriving both from one
 * function is what stops the number the user sees from disagreeing with the records the model
 * actually reconciles against.
 *
 * `records` must contain **tasks, meetings and docs of kind `doc` only** — see
 * `computeContextFreshness`.
 *
 * Bias: a date-only *record* is taken at its **upper** bound and a date-only *state* stamp at
 * its **lower** bound, so ambiguity always resolves toward "changed". A record surfaced
 * needlessly costs the model a few tokens; one withheld hides the drift this feature exists to
 * surface.
 */
export function selectChangedRecords<T extends Stamped>(
  state: Stamped | undefined,
  records: readonly T[],
): T[] {
  // Records with no stamp at all are excluded rather than assigned a date. "No date" is
  // representable in this data model, and fabricating one would be a lie.
  const stamped = records
    .map((record) => ({ record, at: bounds(stampOf(record)) }))
    .filter((entry): entry is { record: T; at: { lo: number; hi: number } } => entry.at !== undefined);

  // No state file, or an undated one: nothing has been reconciled, so everything counts.
  const lo = state ? bounds(stampOf(state))?.lo : undefined;
  const changed = lo === undefined ? stamped : stamped.filter((entry) => entry.at.hi > lo);

  return changed.sort((a, b) => b.at.hi - a.at.hi).map((entry) => entry.record);
}

/**
 * Compare the state file against the records it is supposed to summarize.
 *
 * `records` must contain **tasks, meetings and docs of kind `doc` only**. If context docs leak
 * in, the snapshot ends up compared against itself and the result is meaningless.
 *
 * One limit worth knowing rather than pretending away: any save stamps `updated`, so a typo fix
 * in the state file reads as a review. Freshness is a heuristic about reconciliation and can be
 * gamed by a keystroke. UI copy must therefore say "Reviewed 3 days ago", never "Verified
 * accurate".
 */
export function computeContextFreshness(
  state: Stamped | undefined,
  records: readonly Stamped[],
): ContextFreshness {
  const changedSince = selectChangedRecords(state, records).length;

  if (!state) {
    // No snapshot yet. With records present this is the adoption case — the map has never seen
    // the work — which must read as actionable, not as "up to date".
    return { status: changedSince > 0 ? "never" : "empty", changedSince };
  }

  const stamp = stampOf(state);
  if (bounds(stamp) === undefined) {
    // An undated snapshot cannot be verified against anything, so treat it as stale.
    return { status: "stale", changedSince };
  }

  return {
    status: changedSince > 0 ? "stale" : "fresh",
    contextUpdated: stamp,
    changedSince,
  };
}
