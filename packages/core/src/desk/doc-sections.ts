/**
 * H2-section parsing and the AI merge.
 *
 * This module is the safety mechanism behind Context Refresh. The model is asked to
 * rewrite parts of a document the user cares about, so "the prompt told it not to touch
 * that" is not good enough — the merge here makes it *structurally impossible* for the
 * model to damage the user's own words.
 *
 * The invariant: **the merged output is always rebuilt from the ORIGINAL's section list,
 * order, and heading text.** The model's output only ever supplies section *bodies*, matched
 * on a normalized heading key. It can therefore never rename a heading, never add one, never
 * reorder, and never touch a section that was not explicitly handed to it.
 *
 * Pure — no I/O, no clock.
 */

/** Who is allowed to change a section's body during a merge. */
export type SectionOwner =
  /** Restored verbatim from the original, always. The default for anything unrecognized. */
  | "human"
  /** Replaced wholesale by the model's body (unless it is missing or blank). */
  | "ai"
  /** Union: every original line survives verbatim and in order; the model may only add. */
  | "ai-append";

export interface SectionSpec {
  heading: string;
  owner: SectionOwner;
}

export interface DocSection {
  /** The heading text as written, e.g. "What this is". */
  heading: string;
  /** Normalized match key — see `sectionKey`. */
  key: string;
  body: string;
}

export interface SectionedDoc {
  /** Everything before the first `## ` heading (typically the `# Title` line). */
  preamble: string;
  sections: DocSection[];
}

export type MergeWarning =
  | { kind: "no-headings" }
  | { kind: "unknown-section"; heading: string }
  | { kind: "dropped-section"; heading: string }
  | { kind: "human-section-modified"; heading: string }
  | { kind: "line-restored"; heading: string; line: string };

export type SectionStatus = "unchanged" | "rewritten" | "added" | "kept";

export interface SectionChange {
  heading: string;
  owner: SectionOwner;
  status: SectionStatus;
  before: string;
  after: string;
}

export interface SectionMergeResult {
  /** The merged document. The ONLY string a caller may write to disk. */
  content: string;
  sections: SectionChange[];
  warnings: MergeWarning[];
  /** False when the model's output was unusable. Callers must not offer "Apply". */
  usable: boolean;
}

/**
 * Normalize a heading into a match key: lowercased, emphasis/backticks stripped, trailing
 * punctuation dropped, whitespace collapsed. So "## **Current State:**" matches "Current state".
 */
export function sectionKey(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[*_`]/g, "")
    .replace(/[:.\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Opening/closing fence, per CommonMark: ``` or ~~~, closing fence at least as long. */
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;
const H2_RE = /^##\s+(.+)$/;

/**
 * Split markdown on `## ` headings. Fence-aware: a `## ` inside a code block is content,
 * not a heading.
 */
export function parseH2Sections(md: string): SectionedDoc {
  const lines = md.split("\n");
  const preamble: string[] = [];
  const sections: DocSection[] = [];
  let current: { heading: string; body: string[] } | null = null;
  let fence: string | null = null;

  for (const line of lines) {
    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (fence === null) {
        fence = marker;
      } else if (marker[0] === fence[0] && marker.length >= fence.length) {
        fence = null;
      }
    }

    const h2 = fence === null ? H2_RE.exec(line) : null;
    if (h2) {
      if (current) {
        sections.push({
          heading: current.heading,
          key: sectionKey(current.heading),
          body: current.body.join("\n").trim(),
        });
      }
      current = { heading: h2[1].trim(), body: [] };
      continue;
    }

    if (current) current.body.push(line);
    else preamble.push(line);
  }

  if (current) {
    sections.push({
      heading: current.heading,
      key: sectionKey(current.heading),
      body: current.body.join("\n").trim(),
    });
  }

  return { preamble: preamble.join("\n").trim(), sections };
}

export function serializeH2Sections(doc: SectionedDoc): string {
  const parts: string[] = [];
  if (doc.preamble) parts.push(doc.preamble);
  for (const section of doc.sections) {
    parts.push(`## ${section.heading}\n\n${section.body}`.trimEnd());
  }
  return `${parts.join("\n\n")}\n`;
}

/**
 * Strip a frontmatter block the model re-emitted, and unwrap the output if the model
 * fenced the *entire* response. Both are routine model behaviours when you ask for
 * "the full document back".
 */
function sanitizeModelOutput(raw: string): string {
  let out = raw.trim();

  if (out.startsWith("---")) {
    const end = out.indexOf("\n---", 3);
    if (end !== -1) {
      const after = out.indexOf("\n", end + 1);
      out = (after === -1 ? "" : out.slice(after + 1)).trim();
    }
  }

  const fenced = /^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n?\1\s*$/.exec(out);
  if (fenced) out = fenced[2].trim();

  return out;
}

/** Collapse a line for duplicate detection in `ai-append` — presentation-insensitive. */
function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Union an `ai-append` section: every original non-empty line survives, verbatim and in
 * order; model lines are appended only when not already present.
 *
 * This exists to prevent the worst data-loss mode in the app: a model that does not see a
 * decision mentioned in the recent records would otherwise silently delete it from the map.
 */
function appendMerge(
  originalBody: string,
  aiBody: string,
  heading: string,
  warnings: MergeWarning[],
): string {
  const originalLines = originalBody.split("\n");
  const aiLines = aiBody.split("\n");
  const kept = new Set(originalLines.map(normalizeLine).filter(Boolean));
  const aiSeen = new Set(aiLines.map(normalizeLine).filter(Boolean));

  const additions: string[] = [];
  for (const line of aiLines) {
    const norm = normalizeLine(line);
    if (!norm || kept.has(norm)) continue;
    kept.add(norm);
    additions.push(line);
  }

  // An original line the model omitted is restored silently — but surfaced, because a model
  // dropping a decision is exactly what this merge exists to catch.
  for (const line of originalLines) {
    const norm = normalizeLine(line);
    if (norm && !aiSeen.has(norm)) {
      warnings.push({ kind: "line-restored", heading, line: line.trim() });
    }
  }

  if (additions.length === 0) return originalBody;
  const base = originalBody.trimEnd();
  return base ? `${base}\n${additions.join("\n")}` : additions.join("\n");
}

/**
 * Merge the model's rewrite into the original, enforcing section ownership.
 *
 * Every failure mode (renamed heading, dropped section, invented heading, prose with no
 * headings, blanked body, rewritten human section) resolves to *keep the original and warn*.
 * There is no path through this function that loses the user's text.
 */
export function mergeAISections(
  originalBody: string,
  aiBody: string,
  spec: readonly SectionSpec[],
): SectionMergeResult {
  const warnings: MergeWarning[] = [];
  const original = parseH2Sections(originalBody);
  const ai = parseH2Sections(sanitizeModelOutput(aiBody));

  // The model returned prose, not a document. Never write raw model output.
  if (ai.sections.length === 0) {
    return {
      content: originalBody,
      sections: [],
      warnings: [{ kind: "no-headings" }],
      usable: false,
    };
  }

  const ownerByKey = new Map(spec.map((s) => [sectionKey(s.heading), s.owner]));
  const aiByKey = new Map<string, DocSection>();
  for (const section of ai.sections) {
    if (!aiByKey.has(section.key)) aiByKey.set(section.key, section);
  }

  const changes: SectionChange[] = [];
  const merged: DocSection[] = [];
  const usedKeys = new Set<string>();

  for (const section of original.sections) {
    // Default-deny: a section we did not explicitly hand to the AI is the user's.
    const owner = ownerByKey.get(section.key) ?? "human";
    const fromAI = aiByKey.get(section.key);
    usedKeys.add(section.key);

    let body = section.body;
    let status: SectionStatus = "unchanged";

    if (owner === "human") {
      if (fromAI && fromAI.body.trim() !== section.body.trim()) {
        warnings.push({ kind: "human-section-modified", heading: section.heading });
      }
    } else if (owner === "ai-append") {
      body = appendMerge(section.body, fromAI?.body ?? "", section.heading, warnings);
      status = body === section.body ? "unchanged" : "rewritten";
      if (!fromAI) warnings.push({ kind: "dropped-section", heading: section.heading });
    } else {
      // Blanking a section is data loss, and is indistinguishable from dropping it.
      if (!fromAI || !fromAI.body.trim()) {
        warnings.push({ kind: "dropped-section", heading: section.heading });
        status = "kept";
      } else if (fromAI.body.trim() !== section.body.trim()) {
        body = fromAI.body;
        status = "rewritten";
      }
    }

    merged.push({ ...section, body });
    changes.push({
      heading: section.heading,
      owner,
      status,
      before: section.body,
      after: body,
    });
  }

  // A spec section the user deleted from their brief, which the model supplied: re-add it.
  for (const s of spec) {
    const key = sectionKey(s.heading);
    if (s.owner === "human" || usedKeys.has(key)) continue;
    const fromAI = aiByKey.get(key);
    if (!fromAI || !fromAI.body.trim()) continue;
    usedKeys.add(key);
    merged.push({ heading: s.heading, key, body: fromAI.body });
    changes.push({
      heading: s.heading,
      owner: s.owner,
      status: "added",
      before: "",
      after: fromAI.body,
    });
  }

  // Headings the model invented. Never let it grow the file.
  for (const section of ai.sections) {
    if (!usedKeys.has(section.key)) {
      warnings.push({ kind: "unknown-section", heading: section.heading });
    }
  }

  return {
    // Preamble and headings always come from the original: the `# Title` line is protected
    // and a heading rename can never survive.
    content: serializeH2Sections({ preamble: original.preamble, sections: merged }),
    sections: changes,
    warnings,
    usable: true,
  };
}

/**
 * Re-serialize a merge with only some sections accepted. Rejected sections fall back to
 * their `before` body. Used by the preview dialog's per-section checkboxes.
 */
export function applySectionSelection(
  originalBody: string,
  result: SectionMergeResult,
  acceptedHeadings: ReadonlySet<string>,
): string {
  const original = parseH2Sections(originalBody);
  const byKey = new Map(result.sections.map((c) => [sectionKey(c.heading), c]));
  const sections: DocSection[] = original.sections.map((section) => {
    const change = byKey.get(section.key);
    if (!change) return section;
    const accepted = acceptedHeadings.has(change.heading);
    return { ...section, body: accepted ? change.after : change.before };
  });

  for (const change of result.sections) {
    if (change.status !== "added" || !acceptedHeadings.has(change.heading)) continue;
    sections.push({
      heading: change.heading,
      key: sectionKey(change.heading),
      body: change.after,
    });
  }

  return serializeH2Sections({ preamble: original.preamble, sections });
}
