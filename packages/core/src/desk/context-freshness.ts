/**
 * Context freshness: has the map drifted from the records?
 *
 * Pure — no I/O, no clock. The answer depends only on the stamps handed in, so it is
 * deterministic and reasonable-about.
 *
 * The signal is **causal, not chronological**: "N records changed since the context was last
 * touched", never "the context is 14 days old". Age is not evidence of drift. A stable project
 * with a six-month-old brief is fine; a busy one with a two-week-old brief is not.
 */

/** Anything carrying the two frontmatter stamps: Doc, Task, Meeting. */
export interface Stamped {
  updated?: string;
  created?: string;
}

export type ContextFreshnessStatus = "empty" | "fresh" | "stale";

export interface ContextFreshness {
  status: ContextFreshnessStatus;
  /** Newest raw context stamp. For display only — never compare this lexicographically. */
  contextUpdated?: string;
  /** Records provably newer than the context. */
  changedSince: number;
  fileCount: number;
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
 *    A record written at 18:00 carrying only `created` would read as older than a context
 *    refreshed at 09:00 — drift silently reported as fresh. This is the dangerous direction.
 *  - At UTC+2, a record created 00:30 local on the 14th (`created: "2026-07-14"`, real instant
 *    `2026-07-13T22:30Z`) sorts after a context refreshed at `"2026-07-13T23:00Z"` — stale,
 *    though the map is current.
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
 * When the map was last touched: the newest lower bound across the context files, plus the raw
 * stamp that produced it (for display).
 *
 * `lo` is undefined when no context file carries a usable stamp — an undated map, which cannot
 * be verified against anything.
 */
function contextThreshold(contextDocs: readonly Stamped[]): { lo?: number; stamp?: string } {
  let lo: number | undefined;
  let stamp: string | undefined;

  for (const doc of contextDocs) {
    const raw = stampOf(doc);
    const b = bounds(raw);
    if (!b) continue;
    if (lo === undefined || b.lo > lo) {
      lo = b.lo;
      stamp = raw;
    }
  }

  return { lo, stamp };
}

/**
 * The records provably newer than the context, newest first.
 *
 * This is the single definition of "changed since the map was last touched": the freshness count
 * below is this list's length, and the AI refresh sends this list's head to the model. Deriving
 * both from one function is what stops the number the user sees from disagreeing with the records
 * the model actually reconciles against.
 *
 * `records` must contain **tasks, meetings and docs of kind `doc` only** — see
 * `computeContextFreshness`.
 *
 * Bias: a date-only *record* is taken at its **upper** bound and a date-only *context* stamp at
 * its **lower** bound, so ambiguity always resolves toward "changed". A record surfaced
 * needlessly costs the model a few tokens; one withheld hides the drift this feature exists to
 * surface.
 */
export function selectChangedRecords<T extends Stamped>(
  contextDocs: readonly Stamped[],
  records: readonly T[],
): T[] {
  // No map at all: there is nothing to reconcile against, so nothing has "changed since" it.
  if (contextDocs.length === 0) return [];

  const { lo } = contextThreshold(contextDocs);

  // Records with no stamp at all are excluded rather than assigned a date. "No date" is
  // representable in this data model, and fabricating one would be a lie.
  const stamped = records
    .map((record) => ({ record, at: bounds(stampOf(record)) }))
    .filter((entry): entry is { record: T; at: { lo: number; hi: number } } => entry.at !== undefined);

  // An undated map cannot be verified against anything, so every record counts as newer.
  const changed = lo === undefined ? stamped : stamped.filter((entry) => entry.at.hi > lo);

  return changed.sort((a, b) => b.at.hi - a.at.hi).map((entry) => entry.record);
}

/**
 * Compare context docs against the records they are supposed to summarize.
 *
 * `records` must contain **tasks, meetings and docs of kind `doc` only**. If context docs leak
 * in, the map ends up compared against itself and the result is meaningless.
 *
 * Two limits worth knowing rather than pretending away:
 *  - The newest stamp across *all* context files is used, so editing an unrelated context file
 *    marks the map fresh while the brief itself rots. Harmless while a project has ~1 context
 *    file; compute per-doc if that stops being true.
 *  - Any save stamps `updated`, so a typo fix in the brief reads as a review. Freshness is a
 *    heuristic about reconciliation and can be gamed by a keystroke. UI copy must therefore say
 *    "Reviewed 3 days ago", never "Verified accurate".
 */
export function computeContextFreshness(
  contextDocs: readonly Stamped[],
  records: readonly Stamped[],
): ContextFreshness {
  const fileCount = contextDocs.length;
  if (fileCount === 0) {
    return { status: "empty", changedSince: 0, fileCount: 0 };
  }

  const { lo, stamp } = contextThreshold(contextDocs);
  const changedSince = selectChangedRecords(contextDocs, records).length;

  // An undated map cannot be verified against anything, so treat it as stale.
  if (lo === undefined) {
    return { status: "stale", changedSince, fileCount };
  }

  return {
    status: changedSince > 0 ? "stale" : "fresh",
    contextUpdated: stamp,
    changedSince,
    fileCount,
  };
}
